import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projectPaths } from '../../src/core/projects/projectStore';
import { validateMp4 } from '../../src/core/render/renderer';
import { memoryCipher } from '../../src/core/settings/settingsStore';
import { Studio, defaultPaths } from '../../src/core/studio';
import type { ProgressEvent } from '../../src/core/pipeline/progress';
import { TEST_VOICES_DIR } from '../helpers';

/**
 * Complete end-to-end generation of a small video with the default (local,
 * zero-cost) providers: offline story engine, Piper voice, vector library,
 * Remotion render, FFmpeg export. Then recovery scenarios.
 */
const BUNDLE = path.resolve('build/remotion-bundle');
let studio: Studio;
let dataDir: string;

beforeAll(async () => {
  if (!fs.existsSync(path.join(BUNDLE, 'index.html'))) throw new Error('Run "npm run build:remotion" before the e2e tests.');
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvs-e2e-'));
  const paths = { ...defaultPaths(dataDir, BUNDLE), voicesDir: TEST_VOICES_DIR };
  studio = await Studio.create({ paths, cipher: memoryCipher, persist: true });
  await studio.settings.update({ renderConcurrency: Math.max(1, Math.min(4, os.cpus().length)), exportQuality: 'standard' });
});

afterAll(async () => {
  await studio?.close();
  if (process.env.FVS_KEEP !== '1') fs.rmSync(dataDir, { recursive: true, force: true });
  else console.log('Kept e2e data in', dataDir);
});

describe('end-to-end generation', () => {
  let projectId: string;

  it('generates, validates and saves a complete 30 s video', async () => {
    const project = await studio.projects.create({
      topic: 'What if you received €1 million at age 18?',
      duration: '30',
      language: 'fr',
      narrator: 'female',
      storytelling: 'hypothetical',
      visualStyle: 'minimal-finance',
    });
    projectId = project.id;
    const events: ProgressEvent[] = [];
    const off = studio.queue.onProgress((e) => events.push(e));
    await studio.queue.enqueue(projectId);
    await studio.queue.whenIdle();
    off();
    const done = await studio.projects.get(projectId);
    if (done.status !== 'completed') console.error(done.error, done.stages);
    expect(done.status).toBe('completed');
    for (const s of Object.values(done.stages)) expect(s.status).toBe('done');

    // Progress is monotonic per run and ends at 100 % only after the export finished.
    const overall = events.filter((e) => e.status === 'running').map((e) => e.overall);
    for (let i = 1; i < overall.length; i++) expect(overall[i]!).toBeGreaterThanOrEqual(overall[i - 1]! - 1e-9);
    expect(events.at(-1)!.status).toBe('completed');

    const p = projectPaths(studio.projects.dirFor(projectId));
    for (const f of [p.projectJson, p.scriptJson, p.storyboardJson, p.finalMp4, p.thumbnail, path.join(p.subtitlesDir, 'subtitles.srt'), path.join(p.audioDir, 'narration.wav')]) {
      expect(fs.existsSync(f), f).toBe(true);
    }
    expect(fs.readdirSync(p.charactersDir).some((f) => f.endsWith('.svg'))).toBe(true);
    expect(fs.readdirSync(p.illustrationsDir).some((f) => f.endsWith('.svg'))).toBe(true);

    const v = await validateMp4(p.finalMp4, studio.ffmpeg(), { width: 1080, height: 1920, fps: 30, durationSec: done.durationSec! });
    expect(v.issues).toEqual([]);
    expect(done.durationSec!).toBeGreaterThan(15);
    expect(done.fileSize!).toBeGreaterThan(200_000);

    // Library listing + dashboard stats reflect the result.
    const list = await studio.projects.list();
    expect(list.find((x) => x.id === projectId)?.hasVideo).toBe(true);
    const dash = await studio.dashboard();
    expect(dash.completed).toBeGreaterThanOrEqual(1);
    expect(dash.totalCostUsd).toBe(0);
  });

  it('resumes after a cancellation without redoing finished stages', async () => {
    const project = await studio.projects.duplicate(projectId);
    await studio.pipeline.resetFrom(project.id, 'render');
    // Remove two rendered scenes from the copy to force real rendering work.
    const p = projectPaths(studio.projects.dirFor(project.id));
    const chunks = fs.readdirSync(p.scenesDir).filter((f) => f.endsWith('.mp4')).sort();
    fs.rmSync(path.join(p.scenesDir, chunks[1]!));
    fs.rmSync(path.join(p.scenesDir, chunks[2]!));

    const controller = new AbortController();
    const run = studio.pipeline.run(project.id, {
      signal: controller.signal,
      onProgress: (e) => {
        if (e.stage === 'render' && e.message.includes('Rendering scene 3')) controller.abort();
      },
    });
    const cancelled = await run;
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.failedStage).toBe('render');
    expect(cancelled.stages.voice.status).toBe('done');

    const messages: string[] = [];
    const resumed = await studio.pipeline.run(project.id, { onProgress: (e) => messages.push(e.message) });
    expect(resumed.status).toBe('completed');
    expect(messages).toContain('Writing script — reused');
    expect(messages).toContain('Generating voice — reused');
    expect(messages.some((m) => m.includes('Rendering scene 1/') && m.includes('(cached)'))).toBe(true);
    expect(fs.existsSync(p.finalMp4)).toBe(true);
  });

  it('reports a useful, retryable failure when the renderer cannot start, then recovers', async () => {
    const project = await studio.projects.duplicate(projectId);
    await studio.pipeline.resetFrom(project.id, 'render');
    const p = projectPaths(studio.projects.dirFor(project.id));
    fs.rmSync(p.scenesDir, { recursive: true, force: true });
    const original = studio.settings.get().browserExecutable;
    await studio.settings.update({ browserExecutable: '/nonexistent/chrome', maxRetries: 0 });
    const failed = await studio.pipeline.run(project.id);
    expect(failed.status).toBe('failed');
    expect(failed.failedStage).toBe('render');
    expect(failed.error).toBeTruthy();
    expect(failed.stages.subtitles.status).toBe('done');
    await studio.settings.update({ browserExecutable: original, maxRetries: 2 });
    const ok = await studio.pipeline.run(project.id);
    if (ok.status !== 'completed') console.error('recovery failed:', ok.error, ok.stages.render);
    expect(ok.status).toBe('completed');
  });
});
