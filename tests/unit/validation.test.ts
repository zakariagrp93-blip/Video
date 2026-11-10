import { describe, expect, it } from 'vitest';
import { OfflineLLMProvider } from '../../src/core/providers/llm/offline/offlineLlm';
import { storyboardFromLlm, type LlmStoryboard } from '../../src/core/providers/llm/llmSchemas';
import { buildScriptRequest, generateValidatedScript, validateScript } from '../../src/core/script/scriptEngine';
import { repairStoryboard, reviewStoryboardRules } from '../../src/core/storyboard/rules';
import { validateStoryboard } from '../../src/core/storyboard/storyboardEngine';
import { GenerationOptionsSchema, ScriptSchema, StoryboardSchema, type Script, type Storyboard } from '../../src/shared/schemas';
import { testContext } from '../helpers';

const options = GenerationOptionsSchema.parse({ topic: 'What if you received €1 million at age 18?', duration: '60', language: 'fr', narrator: 'auto', storytelling: 'hypothetical', visualStyle: 'minimal-finance' });
const req = buildScriptRequest(options);

async function baseline(): Promise<{ script: Script; storyboard: Storyboard }> {
  const { ctx } = await testContext();
  const p = new OfflineLLMProvider();
  const script = await p.generateScript(req, ctx);
  const storyboard = await p.generateStoryboard(script, req, ctx);
  return { script, storyboard };
}

describe('script JSON validation', () => {
  it('accepts a well-formed script', async () => {
    const { script } = await baseline();
    expect(validateScript(script, req).errors).toEqual([]);
  });
  it('rejects malformed JSON structure', () => {
    const v = validateScript({ version: 1, title: 'x' } as unknown as Script, req);
    expect(v.errors.length).toBeGreaterThan(0);
    expect(ScriptSchema.safeParse({ scenes: [] }).success).toBe(false);
  });
  it('flags generic AI phrasing, unsourced facts, wrong language and a missing hook', async () => {
    const { script } = await baseline();
    const bad: Script = structuredClone(script);
    bad.scenes[1]!.narration = 'Dans cette vidéo, plongeons dans le sujet.';
    bad.claims.push({ text: '78 % des gagnants du loto font faillite', kind: 'fact' });
    bad.hook = 'Une accroche totalement différente qui ne correspond pas';
    const v = validateScript(bad, req);
    expect(v.errors.some((e) => e.includes('generic'))).toBe(true);
    expect(v.errors.some((e) => e.includes('source'))).toBe(true);
    expect(v.errors.some((e) => e.includes('hook'))).toBe(true);
    const english: Script = structuredClone(script);
    english.scenes = english.scenes.map((s) => ({ ...s, narration: 'You and the money and the bank is not for you with that and the plan for the year.' }));
    expect(validateScript(english, req).errors.some((e) => e.includes('written in fr'))).toBe(true);
  });
  it('flags length outside the target and regenerates remote scripts with feedback', async () => {
    const { script } = await baseline();
    const long: Script = structuredClone(script);
    long.scenes = long.scenes.map((s) => ({ ...s, narration: `${s.narration} ${s.narration} ${s.narration}` }));
    expect(validateScript(long, req).errors.some((e) => e.includes('too long'))).toBe(true);

    // A fake remote provider that only fixes the script after receiving feedback.
    const { ctx } = await testContext();
    const feedbacks: Array<string[] | undefined> = [];
    const remote = {
      ...new OfflineLLMProvider(),
      id: 'fake',
      isLocal: false,
      generateScript: async (_r: unknown, _c: unknown, feedback?: string[]) => {
        feedbacks.push(feedback);
        return feedback ? script : long;
      },
    } as unknown as OfflineLLMProvider;
    const res = await generateValidatedScript(remote, req, ctx, 3);
    expect(res.attempts).toBe(2);
    expect(feedbacks[1]?.some((f) => f.includes('too long'))).toBe(true);
  });
});

describe('storyboard validation', () => {
  it('validates a generated storyboard against the script', async () => {
    const { script, storyboard } = await baseline();
    expect(StoryboardSchema.safeParse(storyboard).success).toBe(true);
    expect(validateStoryboard(storyboard, script).errors).toEqual([]);
  });
  it('detects narration drift and scene count mismatch', async () => {
    const { script, storyboard } = await baseline();
    const drift = structuredClone(storyboard);
    drift.scenes[2]!.narration = 'Autre chose';
    expect(validateStoryboard(drift, script).errors.some((e) => e.includes('verbatim'))).toBe(true);
    const fewer = structuredClone(storyboard);
    fewer.scenes = fewer.scenes.slice(0, 8);
    expect(validateStoryboard(fewer, script).errors.some((e) => e.includes('scenes'))).toBe(true);
  });
  it('repairs overlapping composition deterministically', async () => {
    const { storyboard } = await baseline();
    const broken = structuredClone(storyboard);
    broken.scenes[1]!.character.position = 'left';
    broken.scenes[1]!.props = [
      { asset: 'car', animation: 'pop', placement: 'left', count: 1, delay: 0 },
      { asset: 'house', animation: 'pop', placement: 'left', count: 1, delay: 0 },
    ];
    expect(reviewStoryboardRules(broken).length).toBeGreaterThan(0);
    const fixed = repairStoryboard(broken);
    const sc = fixed.scenes[1]!;
    expect(sc.props.map((p) => p.placement)).not.toContain('left');
    expect(new Set(sc.props.map((p) => p.placement)).size).toBe(sc.props.length);
    expect(fixed.scenes[0]!.transition).toBe('cut');
  });
  it('converts LLM structured output into a valid storyboard', async () => {
    const { script } = await baseline();
    const raw: LlmStoryboard = {
      scenes: script.scenes.map(() => ({
        character: { visible: true, pose: 'explaining', expression: 'happy', position: 'left', motion: 'none', facing: 'right' },
        background: 'spotlight',
        props: [{ asset: 'coin', animation: 'pop', placement: 'right', count: 30, label: '', delay: 2, imageKey: 'BAD KEY' }],
        effect: 'none',
        camera: 'zoom-in',
        transition: 'fade',
        overlay: { enabled: true, text: '45 000 €', style: 'number', counterEnabled: true, counterFrom: 0, counterTo: 45000, prefix: '', suffix: ' €' },
        chart: { enabled: false, kind: 'line', trend: 'up', values: [], label: '' },
        sfx: [{ type: 'coin', at: 'start' }],
      })),
      illustrations: [{ key: 'golden-key', prompt: 'a golden key' }, { key: 'Invalid Key!', prompt: 'x' }],
    };
    const sb = storyboardFromLlm(raw, script);
    const parsed = StoryboardSchema.parse(sb);
    expect(parsed.scenes[0]!.props[0]!.count).toBe(12); // clamped
    expect(parsed.scenes[0]!.props[0]!.delay).toBe(0.9);
    expect(parsed.scenes[0]!.props[0]!.imageKey).toBeUndefined();
    expect(parsed.illustrations.map((i) => i.key)).toEqual(['golden-key']);
    expect(parsed.scenes[0]!.narration).toBe(script.scenes[0]!.narration);
  });
});
