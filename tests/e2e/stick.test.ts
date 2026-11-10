import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projectPaths } from '../../src/core/projects/projectStore';
import { RemoteLLMProvider, type JsonRequest, type TextRequest } from '../../src/core/providers/llm/remoteLlm';
import { OfflineLLMProvider } from '../../src/core/providers/llm/offline/offlineLlm';
import type { ConnectionTestResult, ProviderContext } from '../../src/core/providers/types';
import { validateMp4 } from '../../src/core/render/renderer';
import { buildScriptRequest } from '../../src/core/script/scriptEngine';
import { memoryCipher } from '../../src/core/settings/settingsStore';
import { Studio, defaultPaths } from '../../src/core/studio';
import { DEMO_STICK_SHOTS } from '../../src/remotion/stick/demoShots';
import { GenerationOptionsSchema } from '../../src/shared/schemas';
import { TEST_VOICES_DIR, testContext } from '../helpers';

/**
 * Stick-figure explainer end to end with a scripted stand-in for Claude: the first shot list
 * throws at render time (the app must send the error back), the second is valid, and the
 * frame review answers OK. Everything else is the real pipeline: voice, timing, strict
 * still checks, contact sheet, chunked render, export.
 */
class FakeClaude extends RemoteLLMProvider {
  readonly id = 'anthropic';
  readonly label = 'Fake Claude';
  calls: TextRequest[] = [];
  constructor() {
    super(() => 'fake-model');
  }
  checkReady(): string | null {
    return null;
  }
  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, message: 'fake' };
  }
  protected async completeJson<S extends z.ZodType>(req: JsonRequest<S>, ctx: ProviderContext): Promise<z.infer<S>> {
    // Script: reuse the offline engine's French script in the LLM shape.
    const options = GenerationOptionsSchema.parse({ topic: 'Et si tu recevais 1 million d’euros à 18 ans ?', duration: '30', language: 'fr', narrator: 'female', storytelling: 'hypothetical', visualStyle: 'minimal-finance' });
    const s = await new OfflineLLMProvider().generateScript(buildScriptRequest(options), ctx);
    return req.schema.parse({ title: s.title, hook: s.hook, isHypothetical: true, assumptions: s.assumptions, claims: s.claims.map((c) => ({ ...c, source: c.source ?? '' })), scenes: s.scenes, finalLine: s.finalLine, hashtags: s.hashtags });
  }
  protected async completeText(req: TextRequest): Promise<string> {
    this.calls.push(req);
    if (req.images?.length) return 'OK';
    if (this.calls.length === 1) return '```js\nSHOTS.push({ start: 0, end: DURATION, tr: "cut", draw(ctx, lt, t) { notAFunction(ctx); } });\n```';
    return '```js\n' + DEMO_STICK_SHOTS + '\n```';
  }
}

const BUNDLE = path.resolve('build/remotion-bundle');
let studio: Studio;
let dataDir: string;

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvs-stick-'));
  studio = await Studio.create({ paths: { ...defaultPaths(dataDir, BUNDLE), voicesDir: TEST_VOICES_DIR }, cipher: memoryCipher, persist: true });
  await studio.settings.update({ renderConcurrency: Math.max(1, Math.min(4, os.cpus().length)), exportQuality: 'standard', llmProvider: 'anthropic' });
});
afterAll(async () => {
  await studio?.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('stick-figure explainer', () => {
  it('writes, tests, fixes and renders the shot code into a valid MP4', async () => {
    const fake = new FakeClaude();
    (studio.providers.llm as Record<string, unknown>).anthropic = fake;
    const project = await studio.projects.create({ topic: 'Et si tu recevais 1 million d’euros à 18 ans ?', duration: '30', language: 'fr', narrator: 'female', storytelling: 'hypothetical', visualStyle: 'minimal-finance', category: 'stickfigure' });
    await studio.queue.enqueue(project.id);
    await studio.queue.whenIdle();
    const done = await studio.projects.get(project.id);
    if (done.status !== 'completed') console.error(done.error, done.stages);
    expect(done.status).toBe('completed');
    // 1 broken + 1 fixed + 1 review with the contact sheet.
    expect(fake.calls).toHaveLength(3);
    expect(fake.calls[1]!.prompt).toContain('Rendering failed');
    expect(fake.calls[1]!.prompt).toContain('notAFunction');
    expect(fake.calls[2]!.images?.[0]?.mediaType).toBe('image/jpeg');
    expect(fake.calls[0]!.system).toContain('function drawStick');
    const p = projectPaths(studio.projects.dirFor(project.id));
    expect(fs.readFileSync(path.join(p.renderDir, 'shots.js'), 'utf8')).toContain('SHOTS.push');
    const plan = JSON.parse(fs.readFileSync(path.join(p.renderDir, 'plan.json'), 'utf8'));
    expect(plan.mode).toBe('stick');
    const v = await validateMp4(p.finalMp4, studio.ffmpeg(), { width: 1080, height: 1920, fps: 30, durationSec: plan.durationInFrames / 30 });
    expect(v.issues).toEqual([]);
  }, 600_000);

  it('the offline engine explains that this category needs Claude', async () => {
    const { ctx } = await testContext();
    void ctx;
    const o = GenerationOptionsSchema.parse({ topic: 'Et si tu épargnais 5 € par jour ?', duration: '30', language: 'fr', narrator: 'auto', storytelling: 'hypothetical', visualStyle: 'minimal-finance', category: 'stickfigure' });
    expect(new OfflineLLMProvider().checkReady(o)).toMatch(/Claude/);
  });
});
