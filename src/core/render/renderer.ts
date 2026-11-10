import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { ExportQuality } from '../../shared/constants';
import { QUALITY_CRF } from '../../shared/constants';
import type { PlannedScene, VideoPlan } from '../../shared/schemas';
import type { FFmpeg, ProbeResult } from '../media/ffmpeg';
import { CancelledError, UserFacingError, throwIfAborted } from '../util/errors';
import { ensureDir, exists, safeJoin, writeFileAtomic } from '../util/fsx';
import { hashOf } from '../util/hash';
import { createLogger } from '../util/logger';

const log = createLogger('render');
export const COMPOSITION_ID = 'FinanceVideo';
/** Bump when composition code changes in a way that invalidates cached scene chunks. */
export const RENDER_ENGINE_VERSION = 'fvs-render-2';

type RemotionRenderer = typeof import('@remotion/renderer');
let rendererModule: Promise<RemotionRenderer> | undefined;
function loadRenderer(): Promise<RemotionRenderer> {
  rendererModule ??= import('@remotion/renderer');
  return rendererModule;
}

export interface RenderEnvironment {
  /** Folder with the pre-built Remotion bundle (scripts/bundle-remotion.mjs). */
  serveUrl: string;
  /** Optional Chrome / chrome-headless-shell binary; otherwise Remotion's managed browser is used. */
  browserExecutable?: string | null;
  /** Folder containing Remotion's compositor binaries (set in packaged apps, where node_modules is inside app.asar). */
  binariesDirectory?: string | null;
  concurrency: number;
  quality: ExportQuality;
  ffmpeg: FFmpeg;
  bundleHash: string;
}

export interface SceneRenderProgress {
  sceneIndex: number;
  sceneCount: number;
  sceneFraction: number;
  framesDone: number;
  framesTotal: number;
  cached: boolean;
}

export function bundleHashOf(serveUrl: string): string {
  // The bundle's index.html references content-hashed chunks: hashing it identifies the build.
  try {
    return hashOf(fs.readFileSync(path.join(serveUrl, 'index.html'), 'utf8') + fs.readdirSync(serveUrl).sort().join(','), 12);
  } catch {
    return 'dev';
  }
}

/** Hash of everything that affects one scene's pixels. */
export function sceneChunkKey(plan: VideoPlan, scene: PlannedScene, env: Pick<RenderEnvironment, 'quality' | 'bundleHash'>): string {
  const next = plan.scenes[scene.index + 1];
  const cues = plan.captions.filter((c) => c.endFrame > scene.startFrame && c.startFrame < scene.startFrame + scene.durationInFrames);
  return hashOf({ v: RENDER_ENGINE_VERSION, b: env.bundleHash, q: env.quality, s: scene, n: next?.transition ?? null, c: cues, t: plan.theme, br: plan.brandName ?? '', l: plan.language, i: plan.images }, 20);
}

/**
 * Validate a configured browser path *before* handing it to Remotion: Remotion
 * serialises browser checks on one module-level promise, and a single rejection
 * there poisons every later render until the process restarts.
 */
export function assertBrowserExecutable(browserExecutable?: string | null): void {
  if (browserExecutable && !fs.existsSync(browserExecutable)) {
    throw new UserFacingError(`The configured browser executable does not exist: ${browserExecutable}. Fix or clear it in Settings → Rendering.`, false);
  }
}

export async function ensureRenderBrowser(browserExecutable?: string | null, onProgress?: (fraction: number) => void): Promise<void> {
  const { ensureBrowser } = await loadRenderer();
  await ensureBrowser({
    browserExecutable: browserExecutable || null,
    onBrowserDownload: () => ({
      version: null,
      onProgress: ({ percent }: { percent: number }) => onProgress?.(percent),
    }),
  } as never);
}

/**
 * Render each scene as its own H.264 chunk. Chunks are cached by content hash,
 * so a failed render resumes at the failed scene and an unchanged scene is never re-rendered.
 */
export async function renderSceneChunks(
  plan: VideoPlan,
  scenesDir: string,
  env: RenderEnvironment,
  opts: { signal?: AbortSignal; onProgress?: (p: SceneRenderProgress) => void; keyPlan?: VideoPlan },
): Promise<string[]> {
  assertBrowserExecutable(env.browserExecutable);
  const R = await loadRenderer();
  await ensureDir(scenesDir);
  const inputProps = { plan };
  const composition = await R.selectComposition({
    serveUrl: env.serveUrl,
    id: COMPOSITION_ID,
    inputProps,
    browserExecutable: env.browserExecutable || null,
    binariesDirectory: env.binariesDirectory || null,
    chromiumOptions: { gl: 'swiftshader' },
    logLevel: 'error',
  });
  if (composition.durationInFrames !== plan.durationInFrames) throw new Error('Composition duration does not match the plan.');
  const files: string[] = [];
  const total = plan.durationInFrames;
  let doneFrames = 0;
  for (const scene of plan.scenes) {
    throwIfAborted(opts.signal);
    const key = sceneChunkKey(opts.keyPlan ?? plan, (opts.keyPlan ?? plan).scenes[scene.index]!, env);
    const file = safeJoin(scenesDir, `scene-${String(scene.index + 1).padStart(2, '0')}-${key}.mp4`);
    files.push(file);
    const base = { sceneIndex: scene.index, sceneCount: plan.scenes.length, framesTotal: total };
    if (await exists(file)) {
      doneFrames += scene.durationInFrames;
      opts.onProgress?.({ ...base, sceneFraction: 1, framesDone: doneFrames, cached: true });
      continue;
    }
    // Remove stale chunks for this scene index (older content hash).
    const prefix = `scene-${String(scene.index + 1).padStart(2, '0')}-`;
    for (const f of await fsp.readdir(scenesDir)) if (f.startsWith(prefix) && f !== path.basename(file)) await fsp.rm(path.join(scenesDir, f), { force: true });

    const tmp = `${file}.part.mp4`;
    const { cancelSignal, cancel } = R.makeCancelSignal();
    const onAbort = () => cancel();
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      await R.renderMedia({
        composition,
        serveUrl: env.serveUrl,
        codec: 'h264',
        outputLocation: tmp,
        inputProps,
        frameRange: [scene.startFrame, scene.startFrame + scene.durationInFrames - 1],
        muted: true,
        crf: QUALITY_CRF[env.quality],
        x264Preset: env.quality === 'max' ? 'slow' : 'medium',
        pixelFormat: 'yuv420p',
        colorSpace: 'bt709',
        imageFormat: 'jpeg',
        jpegQuality: 95,
        concurrency: env.concurrency,
        browserExecutable: env.browserExecutable || null,
        binariesDirectory: env.binariesDirectory || null,
        chromiumOptions: { gl: 'swiftshader' },
        cancelSignal,
        logLevel: 'error',
        overwrite: true,
        onProgress: ({ renderedFrames }) => {
          opts.onProgress?.({ ...base, sceneFraction: renderedFrames / scene.durationInFrames, framesDone: doneFrames + renderedFrames, cached: false });
        },
      });
    } catch (err) {
      await fsp.rm(tmp, { force: true });
      if (opts.signal?.aborted) throw new CancelledError();
      throw err;
    } finally {
      opts.signal?.removeEventListener('abort', onAbort);
    }
    await fsp.rename(tmp, file);
    doneFrames += scene.durationInFrames;
    opts.onProgress?.({ ...base, sceneFraction: 1, framesDone: doneFrames, cached: false });
    log.info(`Scene ${scene.index + 1}/${plan.scenes.length} rendered (${scene.durationInFrames} frames)`);
  }
  return files;
}

/** Concatenate chunks losslessly, then mux the mixed audio as AAC with loudness normalisation. */
export async function assembleFinal(
  chunks: string[],
  audioFile: string,
  renderDir: string,
  output: string,
  durationSec: number,
  ffmpeg: FFmpeg,
  opts: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {},
): Promise<void> {
  await ensureDir(renderDir);
  const list = safeJoin(renderDir, 'concat.txt');
  await writeFileAtomic(list, chunks.map((c) => `file '${c.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const videoOnly = safeJoin(renderDir, 'video-only.mp4');
  await ffmpeg.run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', videoOnly], { signal: opts.signal });
  opts.onProgress?.(0.3);
  const tmp = `${output}.part.mp4`;
  await ffmpeg.run(
    [
      '-i', videoOnly,
      '-i', audioFile,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'copy',
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-ac', '2',
      '-t', durationSec.toFixed(3),
      '-movflags', '+faststart',
      tmp,
    ],
    { signal: opts.signal, onProgress: (s) => opts.onProgress?.(0.3 + 0.7 * Math.min(1, s / durationSec)) },
  );
  await fsp.rename(tmp, output);
}

export interface Mp4Validation {
  ok: boolean;
  issues: string[];
  probe: ProbeResult | null;
}

/** Validate the exported file against the delivery spec (1080x1920, H.264, AAC, 30 fps, duration). */
export async function validateMp4(file: string, ffmpeg: FFmpeg, expected: { width: number; height: number; fps: number; durationSec: number }): Promise<Mp4Validation> {
  const issues: string[] = [];
  if (!(await exists(file))) return { ok: false, issues: ['Output file does not exist.'], probe: null };
  let probe: ProbeResult;
  try {
    probe = await ffmpeg.probe(file);
  } catch (err) {
    return { ok: false, issues: [`ffprobe could not read the file: ${(err as Error).message}`], probe: null };
  }
  const v = probe.streams.find((s) => s.codecType === 'video');
  const a = probe.streams.find((s) => s.codecType === 'audio');
  if (!/mp4/.test(probe.formatName)) issues.push(`Container is ${probe.formatName}, expected MP4.`);
  if (!v) issues.push('No video stream.');
  else {
    if (v.codecName !== 'h264') issues.push(`Video codec is ${v.codecName}, expected h264.`);
    if (v.width !== expected.width || v.height !== expected.height) issues.push(`Resolution is ${v.width}x${v.height}, expected ${expected.width}x${expected.height}.`);
    if (Math.abs(v.frameRate - expected.fps) > 0.01) issues.push(`Frame rate is ${v.frameRate}, expected ${expected.fps}.`);
    if (v.pixFmt && v.pixFmt !== 'yuv420p') issues.push(`Pixel format is ${v.pixFmt}, expected yuv420p.`);
  }
  if (!a) issues.push('No audio stream.');
  else if (a.codecName !== 'aac') issues.push(`Audio codec is ${a.codecName}, expected aac.`);
  if (Math.abs(probe.duration - expected.durationSec) > 0.25) issues.push(`Duration is ${probe.duration.toFixed(2)}s, expected ${expected.durationSec.toFixed(2)}s.`);
  // Decode the whole file once to catch corrupt frames.
  try {
    await ffmpeg.run(['-v', 'error', '-xerror', '-i', file, '-f', 'null', '-']);
  } catch (err) {
    issues.push(`Decoding failed: ${(err as Error).message.slice(0, 300)}`);
  }
  return { ok: issues.length === 0, issues, probe };
}

export async function extractThumbnail(video: string, out: string, atSec: number, ffmpeg: FFmpeg): Promise<void> {
  await ffmpeg.run(['-ss', atSec.toFixed(2), '-i', video, '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '3', out]);
}

export async function renderStillFrame(plan: VideoPlan, frame: number, out: string, env: Pick<RenderEnvironment, 'serveUrl' | 'browserExecutable' | 'binariesDirectory'>): Promise<void> {
  assertBrowserExecutable(env.browserExecutable);
  const R = await loadRenderer();
  const inputProps = { plan };
  const common = { browserExecutable: env.browserExecutable || null, binariesDirectory: env.binariesDirectory || null, logLevel: 'error' as const };
  const composition = await R.selectComposition({ serveUrl: env.serveUrl, id: COMPOSITION_ID, inputProps, ...common });
  await R.renderStill({ composition, serveUrl: env.serveUrl, output: out, frame, inputProps, imageFormat: 'png', overwrite: true, ...common });
}

/** Rasterise the mascot reference sheet (used by image providers that accept reference images). */
export async function renderCharacterSheet(out: string, env: Pick<RenderEnvironment, 'serveUrl' | 'browserExecutable' | 'binariesDirectory'>): Promise<void> {
  assertBrowserExecutable(env.browserExecutable);
  const R = await loadRenderer();
  const common = { browserExecutable: env.browserExecutable || null, binariesDirectory: env.binariesDirectory || null, logLevel: 'error' as const };
  const composition = await R.selectComposition({ serveUrl: env.serveUrl, id: 'CharacterSheet', inputProps: {}, ...common });
  await R.renderStill({ composition, serveUrl: env.serveUrl, output: out, frame: 0, inputProps: {}, imageFormat: 'png', overwrite: true, ...common });
}
