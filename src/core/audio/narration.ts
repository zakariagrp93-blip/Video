import path from 'node:path';
import type { Language } from '../../shared/constants';
import type { NarrationManifest, NarrationSegment, Storyboard, WordTiming } from '../../shared/schemas';
import type { ProviderContext, TTSProvider, VoiceInfo } from '../providers/types';
import { alignUtterance } from '../subtitles/align';
import { displayTokens, normalizeForSpeech, splitSentences } from '../text/speech';
import { throwIfAborted } from '../util/errors';
import { ensureDir, safeJoin } from '../util/fsx';
import { resample, writeWav } from './wav';

export const NARRATION_SR = 44100;
export const LEAD_SILENCE = 0.3;
export const SENTENCE_GAP = 0.22;
export const SCENE_GAP = 0.34;
export const TAIL_SILENCE = 1.1;

function trimBounds(samples: Float32Array, sr: number, threshold = 0.012, pad = 0.035): [number, number] {
  let a = 0;
  while (a < samples.length && Math.abs(samples[a]!) < threshold) a++;
  let b = samples.length - 1;
  while (b > a && Math.abs(samples[b]!) < threshold) b--;
  if (a >= b) return [0, samples.length];
  const p = Math.round(pad * sr);
  return [Math.max(0, a - p), Math.min(samples.length, b + p)];
}

export interface NarrationBuildInput {
  storyboard: Storyboard;
  tts: TTSProvider;
  voice: VoiceInfo;
  language: Language;
  speed: number;
  audioDir: string;
  ctx: ProviderContext;
  onScene?: (index: number, total: number) => void;
  /** Pauses (s); motivation edits breathe more between lines. */
  gaps?: { lead: number; sentence: number; scene: number; tail: number };
}

export const EDIT_GAPS = { lead: 0.25, sentence: 0.42, scene: 0.62, tail: 1.8 };

/**
 * Synthesize narration sentence by sentence, measure the real audio, align
 * subtitle words, and assemble a master narration track. Scene timing is
 * derived from these measured durations — never estimated from text.
 */
export async function buildNarration(input: NarrationBuildInput): Promise<NarrationManifest> {
  const { storyboard, tts, voice, language, speed, audioDir, ctx } = input;
  const gaps = input.gaps ?? { lead: LEAD_SILENCE, sentence: SENTENCE_GAP, scene: SCENE_GAP, tail: TAIL_SILENCE };
  await ensureDir(audioDir);
  const segments: NarrationSegment[] = [];
  const sceneAudio: Float32Array[] = [];

  for (let i = 0; i < storyboard.scenes.length; i++) {
    throwIfAborted(ctx.signal);
    input.onScene?.(i, storyboard.scenes.length);
    const scene = storyboard.scenes[i]!;
    const sentences = splitSentences(scene.narration);
    const parts: Float32Array[] = [];
    const words: WordTiming[] = [];
    let cursor = 0;
    let method: NarrationSegment['alignment'] = 'silence-anchored';
    const methods = new Set<string>();
    for (let s = 0; s < sentences.length; s++) {
      const sentence = sentences[s]!;
      const spoken = normalizeForSpeech(sentence, language);
      if (!/[\p{L}\p{N}]/u.test(spoken)) continue;
      const res = await tts.synthesize({ text: spoken, language, voiceId: voice.id, speed }, ctx);
      const mono = resample(res.samples, res.sampleRate, NARRATION_SR);
      const [a, b] = trimBounds(mono, NARRATION_SR);
      const clip = mono.slice(a, b);
      const offsetSec = a / NARRATION_SR;
      const providerWords =
        res.words && res.alignment !== 'none'
          ? { words: res.words.map((w) => ({ ...w, start: Math.max(0, w.start - offsetSec), end: Math.max(0, w.end - offsetSec) })), kind: res.alignment }
          : undefined;
      const aligned = alignUtterance(displayTokens(sentence), clip, NARRATION_SR, language, providerWords);
      methods.add(aligned.method);
      for (const w of aligned.words) words.push({ text: w.text, start: cursor + w.start, end: cursor + w.end });
      parts.push(clip);
      cursor += clip.length / NARRATION_SR;
      if (s < sentences.length - 1) {
        parts.push(new Float32Array(Math.round(gaps.sentence * NARRATION_SR)));
        cursor += gaps.sentence;
      }
    }
    if (parts.length === 0) throw new Error(`Scene ${scene.id} has no speakable narration.`);
    method = methods.has('proportional') ? 'proportional' : methods.has('silence-anchored') ? 'silence-anchored' : ([...methods][0] as NarrationSegment['alignment']);
    const total = parts.reduce((n, p) => n + p.length, 0);
    const joined = new Float32Array(total);
    let o = 0;
    for (const p of parts) {
      joined.set(p, o);
      o += p.length;
    }
    const file = safeJoin(audioDir, `scene-${String(i + 1).padStart(2, '0')}.wav`);
    await writeWav(file, { sampleRate: NARRATION_SR, channels: [joined] });
    sceneAudio.push(joined);
    segments.push({ sceneId: scene.id, file: path.basename(file), duration: joined.length / NARRATION_SR, start: 0, words, alignment: method });
  }

  // Master track: lead + scene, gap, scene, … + tail.
  let t = gaps.lead;
  for (let i = 0; i < segments.length; i++) {
    segments[i]!.start = t;
    t += segments[i]!.duration + (i < segments.length - 1 ? gaps.scene : 0);
  }
  const totalDuration = t + gaps.tail;
  const master = new Float32Array(Math.ceil(totalDuration * NARRATION_SR));
  for (let i = 0; i < segments.length; i++) master.set(sceneAudio[i]!, Math.round(segments[i]!.start * NARRATION_SR));
  const masterFile = safeJoin(audioDir, 'narration.wav');
  await writeWav(masterFile, { sampleRate: NARRATION_SR, channels: [master] });

  return {
    provider: tts.id,
    voice: voice.id,
    sampleRate: NARRATION_SR,
    speed,
    segments,
    totalDuration,
    masterFile: 'narration.wav',
  };
}
