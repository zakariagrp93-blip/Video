import { describe, expect, it } from 'vitest';
import { mixAudio, narrationEnvelope } from '../../src/core/audio/mixer';
import { generateMusic, generateSfx } from '../../src/core/audio/synth';
import { readWav, rms, writeWav } from '../../src/core/audio/wav';
import { alignUtterance, mapProviderWords } from '../../src/core/subtitles/align';
import { buildCaptions, toSrt, toneFor, validateCaptions, type TimedWord } from '../../src/core/subtitles/subtitleEngine';
import { buildSfxTimeline, buildVideoPlan, planScenes } from '../../src/core/timing/timeline';
import { SFX_TYPES } from '../../src/shared/constants';
import { VideoPlanSchema, type NarrationManifest } from '../../src/shared/schemas';
import { OfflineLLMProvider } from '../../src/core/providers/llm/offline/offlineLlm';
import { buildScriptRequest } from '../../src/core/script/scriptEngine';
import { GenerationOptionsSchema } from '../../src/shared/schemas';
import { testContext } from '../helpers';
import path from 'node:path';

async function storyboard() {
  const { ctx } = await testContext();
  const options = GenerationOptionsSchema.parse({ topic: 'What if you received €1 million at age 18?', duration: '60', language: 'fr', narrator: 'auto', storytelling: 'hypothetical', visualStyle: 'minimal-finance' });
  const req = buildScriptRequest(options);
  const p = new OfflineLLMProvider();
  return p.generateStoryboard(await p.generateScript(req, ctx), req, ctx);
}

function fakeNarration(sceneIds: string[], durations: number[]): NarrationManifest {
  let t = 0.3;
  const segments = sceneIds.map((id, i) => {
    const seg = { sceneId: id, file: `s${i}.wav`, duration: durations[i]!, start: t, words: [{ text: 'mot', start: 0.05, end: 0.4 }, { text: 'deux.', start: 0.5, end: durations[i]! - 0.05 }], alignment: 'proportional' as const };
    t += durations[i]! + 0.34;
    return seg;
  });
  return { provider: 'test', voice: 'v', sampleRate: 44100, speed: 1, segments, totalDuration: t - 0.34 + 1.1, masterFile: 'narration.wav' };
}

describe('scene timing from measured audio', () => {
  it('places scene cuts just before each narration segment', async () => {
    const sb = await storyboard();
    const durations = sb.scenes.map((_, i) => 2 + (i % 3));
    const narration = fakeNarration(sb.scenes.map((s) => s.id), durations);
    const { scenes, durationInFrames } = planScenes(sb, narration, 30);
    expect(scenes[0]!.startFrame).toBe(0);
    for (let i = 1; i < scenes.length; i++) {
      expect(scenes[i]!.startFrame).toBe(scenes[i - 1]!.startFrame + scenes[i - 1]!.durationInFrames);
      expect(Math.abs(scenes[i]!.startFrame / 30 - (narration.segments[i]!.start - 0.14))).toBeLessThan(0.05);
    }
    expect(durationInFrames).toBe(Math.ceil(narration.totalDuration * 30));
    const plan = buildVideoPlan(sb, narration, []);
    expect(VideoPlanSchema.safeParse(plan).success).toBe(true);
    const sfx = buildSfxTimeline(plan);
    expect(sfx.length).toBeGreaterThan(5);
    for (const e of sfx) expect(e.time).toBeLessThan(plan.durationInFrames / 30);
  });
});

describe('subtitle engine', () => {
  const words: TimedWord[] = 'Et si tu recevais 1 000 000 € à 18 ans ? Premier réflexe : tout dépenser.'
    .split(' ')
    .map((w, i) => ({ text: w, start: i * 0.3, end: i * 0.3 + 0.25, sceneIndex: i < 10 ? 0 : 1 }));
  const scenes = [
    { startFrame: 0, durationInFrames: 90, emphasis: ['recevais'], negative: [] },
    { startFrame: 90, durationInFrames: 120, emphasis: [], negative: ['dépenser.'] },
  ] as never;

  it('builds short, non-overlapping cues that never cross scenes', () => {
    const cues = buildCaptions(words, scenes);
    expect(validateCaptions(cues, 210)).toEqual([]);
    for (const c of cues) {
      expect(c.words.length).toBeLessThanOrEqual(3);
      const sceneOf = c.startFrame < 90 ? 0 : 1;
      expect(c.endFrame <= 90 || sceneOf === 1).toBe(true);
    }
    expect(cues.some((c) => c.words.some((w) => w.text === '?' || w.text.endsWith('?')))).toBe(true);
  });

  it('colours emphasis yellow, negatives red and numbers automatically', () => {
    expect(toneFor('recevais', ['recevais'], [])).toBe('accent');
    expect(toneFor('dépenser.', [], ['dépenser'])).toBe('danger');
    expect(toneFor('1 000 000 €', [], [])).toBe('accent');
    expect(toneFor('tu', [], [])).toBe('normal');
  });

  it('exports valid SRT', () => {
    const srt = toSrt(buildCaptions(words, scenes), 30);
    expect(srt).toMatch(/^1\n00:00:00,000 --> 00:00:0\d,\d{3}\n/);
  });

  it('maps provider word timestamps onto display tokens (numbers spoken as several words)', () => {
    const tokens = ['Tu', 'as', '1 000 000 €', '!'];
    const spoken = ['Tu', 'as', '1000000', 'euros'].map((t, i) => ({ text: t, start: i * 0.4, end: i * 0.4 + 0.3 }));
    const mapped = mapProviderWords(tokens, spoken, 'fr')!;
    expect(mapped[2]!.text).toBe('1 000 000 €');
    expect(mapped[2]!.start).toBeCloseTo(0.8);
    expect(mapped[2]!.end).toBeCloseTo(1.5);
    expect(mapped[3]!.start).toBeCloseTo(1.5);
  });

  it('anchors phrase boundaries on real pauses in the audio', () => {
    // 1.0 s tone, 0.3 s silence, 1.0 s tone
    const sr = 16000;
    const s = new Float32Array(Math.round(sr * 2.3));
    for (let i = 0; i < s.length; i++) {
      const t = i / sr;
      s[i] = t < 1 || t > 1.3 ? Math.sin(t * 2 * Math.PI * 220) * 0.5 : 0;
    }
    const r = alignUtterance(['Premier', 'réflexe,', 'tout', 'dépenser.'], s, sr, 'fr');
    expect(r.method).toBe('silence-anchored');
    expect(r.words[1]!.end).toBeCloseTo(1.0, 1);
    expect(r.words[2]!.start).toBeCloseTo(1.3, 1);
  });
});

describe('audio generation', () => {
  it('synthesizes every sound effect and a music bed with real signal', () => {
    for (const t of SFX_TYPES) {
      const b = generateSfx(t);
      expect(b.channels[0]!.length).toBeGreaterThan(1000);
      expect(rms(b.channels[0]!)).toBeGreaterThan(0.005);
    }
    const m = generateMusic({ durationSec: 8, seed: 42, mood: 'calm' });
    expect(m.channels.length).toBe(2);
    expect(m.channels[0]!.length / m.sampleRate).toBeGreaterThan(8);
    expect(rms(m.channels[0]!, 44100 * 2, 44100 * 6)).toBeGreaterThan(0.02);
    // Deterministic per seed
    expect(generateMusic({ durationSec: 2, seed: 7 }).channels[0]![5000]).toBe(generateMusic({ durationSec: 2, seed: 7 }).channels[0]![5000]);
  });

  it('ducks the music under the narration and never clips', async () => {
    const { dir } = await testContext('mix');
    const sr = 44100;
    const narr = new Float32Array(sr * 4);
    for (let i = sr; i < sr * 2; i++) narr[i] = Math.sin(i / 7) * 0.6; // speech in second 1-2
    const narrFile = path.join(dir, 'n.wav');
    await writeWav(narrFile, { sampleRate: sr, channels: [narr] });
    const music = { sampleRate: sr, channels: [new Float32Array(sr * 4).fill(0.3), new Float32Array(sr * 4).fill(0.3)] };
    const out = path.join(dir, 'mix.wav');
    const res = await mixAudio({ narrationFile: narrFile, narrationDuration: 4, totalDuration: 4, music: { enabled: true, volume: 1, file: 'unused' }, sfx: [{ type: 'impact', time: 3, gain: 2 }], sfxVolume: 1, narrationVolume: 1.5 }, out, music);
    expect(res.peak).toBeLessThanOrEqual(1);
    const mixed = await readWav(out);
    const env = narrationEnvelope(narr, sr);
    expect(env[Math.round(1.5 / 0.02)]!).toBeGreaterThan(0.1);
    // Music level before speech (0.2–0.8 s) vs. a speech-free tail check on DC level
    const before = mixed.channels[0]!.slice(Math.round(0.2 * sr), Math.round(0.8 * sr)).reduce((a, b) => a + b, 0) / (0.6 * sr);
    const during = mixed.channels[0]!.slice(Math.round(1.3 * sr), Math.round(1.9 * sr)).reduce((a, b) => a + b, 0) / (0.6 * sr);
    expect(during).toBeLessThan(before * 0.6); // ducked (DC music component lowered)
  });
});
