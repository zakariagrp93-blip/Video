import { describe, expect, it } from 'vitest';
import { checkStickCode, compileStickShots, normalizeShots, stickEngine } from '../../src/shared/stick';
import { STICK_ENGINE_NAMES } from '../../src/shared/stickEngine.generated';
import { extractCode, stickShotsPrompt, stickTiming, STICK_SHOTS_SYSTEM } from '../../src/core/stick/stickDirector';
import { DEMO_STICK_SHOTS } from '../../src/remotion/stick/demoShots';

describe('stick-figure shot code', () => {
  it('exposes the engine (rig, primitives, helpers) to the shot code', () => {
    const e = stickEngine();
    for (const n of ['drawStick', 'kf', 'burst', 'drawSky', 'applyCam', 'POSE', 'PAL', 'C', 'walkLegs', 'handheld']) expect(e[n], n).toBeDefined();
    expect(STICK_ENGINE_NAMES.length).toBeGreaterThan(60);
  });

  it('compiles the demo into gap-free shots covering the whole video', () => {
    const shots = compileStickShots(DEMO_STICK_SHOTS, 9);
    expect(shots[0]!.start).toBe(0);
    expect(shots[shots.length - 1]!.end).toBe(9);
    for (let i = 1; i < shots.length; i++) expect(shots[i]!.start).toBe(shots[i - 1]!.end);
  });

  it('rejects code that reaches beyond drawing', () => {
    expect(checkStickCode('SHOTS.push({ start: 0, end: 1, draw(ctx) { fetch("https://x"); } });').join()).toMatch(/fetch/);
    expect(checkStickCode('SHOTS.push({ start: 0, end: 1, draw(ctx) { ctx.canvas.ownerDocument.cookie; } });').join()).toMatch(/ownerDocument/);
    expect(checkStickCode('SHOTS.push({ draw(){ (()=>{}).constructor("return this")() } })').join()).toMatch(/constructor/);
    expect(checkStickCode('// nothing here').join()).toMatch(/No shot/);
    expect(checkStickCode(DEMO_STICK_SHOTS)).toEqual([]);
    expect(() => compileStickShots('SHOTS.push({ start: 0, end: 1, draw(){ window.x = 1; } });', 5)).toThrow(/window/);
  });

  it('fills gaps and drops shots without a draw function', () => {
    const draw = () => {};
    const shots = normalizeShots([{ start: 1, end: 2, draw }, { start: 4, end: 5, draw, tr: 'cut' }, { start: 2, end: 3 } as never], 10);
    expect(shots.map((s) => [s.start, s.end, s.tr])).toEqual([
      [0, 4, 'whip'],
      [4, 10, 'cut'],
    ]);
  });

  it('extracts the code block from a model answer', () => {
    expect(extractCode('Here you go:\n```js\nSHOTS.push({});\n```\nEnjoy')).toBe('SHOTS.push({});');
    expect(extractCode('OK')).toBeNull();
  });

  it('briefs the model with the engine source, the rules and the exact timing', () => {
    expect(STICK_SHOTS_SYSTEM).toContain('function drawStick');
    expect(STICK_SHOTS_SYSTEM).toContain('caption band y 1250–1420');
    const scenes = [
      { id: 's01', index: 0, startFrame: 0, durationInFrames: 60, narration: 'Un.', visualDescription: '', emphasis: [], negative: [], durationHint: 2 },
      { id: 's02', index: 1, startFrame: 60, durationInFrames: 90, narration: 'Deux.', visualDescription: '', emphasis: [], negative: [], durationHint: 3 },
    ] as never;
    const narration = { segments: [{ sceneId: 's01', start: 0.3, duration: 1, words: [{ text: 'Un.', start: 0, end: 0.4 }] }, { sceneId: 's02', start: 2.1, duration: 1, words: [{ text: 'Deux.', start: 0.1, end: 0.5 }] }] } as never;
    const script = { title: 'Test', language: 'fr', scenes: [{ visual: 'a coin' }, { visual: 'a jar' }] } as never;
    const timing = stickTiming(scenes, narration, 30, 150, script);
    expect(timing.duration).toBe(5);
    expect(timing.scenes[1]).toMatchObject({ start: 2, end: 5, words: [{ w: 'Deux.', t: 2.2 }] });
    expect(stickShotsPrompt(script, timing)).toContain('Scene 2  2.00–5.00 s');
  });
});
