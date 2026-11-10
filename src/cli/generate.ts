/**
 * Headless generator — same pipeline as the desktop app, from the command line.
 *
 *   node dist/cli/generate.cjs --topic "What if you received €1 million at age 18?" --lang fr --duration 60
 *
 * Options: --topic, --lang fr|en|es|de, --duration 30|45|60|90|auto, --narrator male|female|auto,
 *          --style educational|hypothetical|facts|storytelling|unexpected, --visual minimal-finance|custom-brand,
 *          --data <dir> (default ./fvs-data), --bundle <remotion bundle dir>, --out <file.mp4>, --quality standard|high|max
 * Uses the settings stored in the data dir; API keys can be supplied via FVS_*_API_KEY env vars.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PIPELINE_STAGE_LABELS } from '../shared/constants';
import { GenerationOptionsSchema } from '../shared/schemas';
import { memoryCipher } from '../core/settings/settingsStore';
import { Studio, defaultPaths } from '../core/studio';
import { formatEtaCli } from './format';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main(): Promise<void> {
  const topic = arg('topic');
  if (!topic) {
    console.error('Usage: generate --topic "<topic>" [--lang fr] [--duration 60] [--out video.mp4]');
    process.exit(2);
  }
  const dataDir = path.resolve(arg('data', 'fvs-data')!);
  const bundle = path.resolve(arg('bundle', path.join(__dirname, '..', '..', 'build', 'remotion-bundle'))!);
  const studio = await Studio.create({ paths: { ...defaultPaths(dataDir, bundle), voicesDir: process.env.FVS_VOICES_DIR ?? path.join(dataDir, 'voices') }, cipher: memoryCipher, persist: true });
  const quality = arg('quality');
  if (quality) await studio.settings.update({ exportQuality: quality as never });
  const options = GenerationOptionsSchema.parse({
    topic,
    language: arg('lang', 'fr'),
    duration: arg('duration', '60'),
    narrator: arg('narrator', 'auto'),
    storytelling: arg('style', 'hypothetical'),
    visualStyle: arg('visual', 'minimal-finance'),
  });
  const project = await studio.projects.create(options);
  console.log(`Project ${project.id} → ${studio.projects.dirFor(project.id)}`);
  let lastLine = '';
  const result = await studio.pipeline.run(project.id, {
    onProgress: (e) => {
      const line = `[${Math.floor(e.overall * 100).toString().padStart(3)}%] ${e.stage ? PIPELINE_STAGE_LABELS[e.stage] : ''} — ${e.message}${formatEtaCli(e.etaSec)}`;
      if (line !== lastLine) {
        lastLine = line;
        console.log(line);
      }
    },
  });
  if (result.status !== 'completed') {
    console.error(`\nFAILED at ${result.failedStage}: ${result.error}`);
    await studio.close();
    process.exit(1);
  }
  const finalMp4 = path.join(studio.projects.dirFor(project.id), 'final.mp4');
  const out = arg('out');
  if (out) {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.copyFileSync(finalMp4, path.resolve(out));
  }
  console.log(`\nDone: "${result.title}" — ${result.durationSec?.toFixed(1)} s, ${((result.fileSize ?? 0) / 1024 / 1024).toFixed(1)} MB`);
  console.log(out ? path.resolve(out) : finalMp4);
  await studio.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
