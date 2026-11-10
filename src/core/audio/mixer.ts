import type { AudioPlan } from '../../shared/schemas';
import type { SfxType } from '../../shared/constants';
import { reverbInPlace } from './editMusic';
import { generateSfx } from './synth';
import { readWav, resample, toMono, writeWav, type AudioBuffer } from './wav';

export const MIX_SR = 44100;

/** Narration envelope used to duck the music under the voice (sidechain-style). */
export function narrationEnvelope(narr: Float32Array, sr: number): Float32Array {
  const win = Math.round(sr * 0.02);
  const n = Math.ceil(narr.length / win);
  const env = new Float32Array(n);
  for (let w = 0; w < n; w++) {
    let s = 0;
    const end = Math.min(narr.length, (w + 1) * win);
    for (let i = w * win; i < end; i++) s += narr[i]! * narr[i]!;
    env[w] = Math.sqrt(s / Math.max(1, end - w * win));
  }
  // Attack 40 ms, release 350 ms
  const att = 1 - Math.exp(-0.02 / 0.04);
  const rel = 1 - Math.exp(-0.02 / 0.35);
  let y = 0;
  for (let w = 0; w < n; w++) {
    const x = env[w]!;
    y += (x > y ? att : rel) * (x - y);
    env[w] = y;
  }
  return env;
}

/**
 * Mix narration + music + SFX into a stereo 44.1 kHz WAV. Music is ducked
 * ~8 dB whenever the narrator speaks; a soft limiter prevents clipping.
 * Loudness normalisation to −14 LUFS happens in the final AAC encode.
 */
export async function mixAudio(plan: AudioPlan, outFile: string, musicOverride?: AudioBuffer): Promise<{ peak: number; duration: number }> {
  const len = Math.ceil(plan.totalDuration * MIX_SR);
  const L = new Float32Array(len);
  const R = new Float32Array(len);

  const edit = plan.profile === 'edit';
  const narrBuf = await readWav(plan.narrationFile);
  const narr = resample(toMono(narrBuf), narrBuf.sampleRate, MIX_SR);
  const vL = new Float32Array(Math.min(len, narr.length));
  const vR = new Float32Array(vL.length);
  for (let i = 0; i < vL.length; i++) vL[i] = vR[i] = narr[i]! * plan.narrationVolume;
  // Edits: a hall around the voice, like the classic motivation-speech sound.
  if (edit) reverbInPlace(vL, vR, MIX_SR, 0.2, 0.8, 0.35);
  for (let i = 0; i < vL.length; i++) {
    L[i]! += vL[i]!;
    R[i]! += vR[i]!;
  }

  if (plan.music.enabled && (plan.music.file || musicOverride)) {
    const music = musicOverride ?? (await readWav(plan.music.file!));
    const mL = resample(music.channels[0]!, music.sampleRate, MIX_SR);
    const mR = resample(music.channels[1] ?? music.channels[0]!, music.sampleRate, MIX_SR);
    const env = narrationEnvelope(narr, MIX_SR);
    const win = Math.round(MIX_SR * 0.02);
    for (let i = 0; i < Math.min(len, mL.length); i++) {
      const e = env[Math.min(env.length - 1, Math.floor(i / win))] ?? 0;
      const duck = 1 - (edit ? 0.42 : 0.6) * Math.min(1, e / 0.04);
      const g = plan.music.volume * (edit ? 2.1 : 1) * duck;
      L[i]! += mL[i]! * g;
      R[i]! += mR[i]! * g;
    }
  }

  const sfxCache = new Map<SfxType, Float32Array>();
  for (const ev of plan.sfx) {
    let s = sfxCache.get(ev.type);
    if (!s) {
      s = generateSfx(ev.type).channels[0]!;
      sfxCache.set(ev.type, s);
    }
    const start = Math.floor(ev.time * MIX_SR);
    const g = ev.gain * plan.sfxVolume;
    for (let i = 0; i < s.length && start + i < len; i++) {
      if (start + i < 0) continue;
      L[start + i]! += s[i]! * g;
      R[start + i]! += s[i]! * g;
    }
  }

  let peak = 0;
  for (let i = 0; i < len; i++) {
    for (const ch of [L, R]) {
      const x = ch[i]!;
      const ax = Math.abs(x);
      // Soft knee limiter above -1 dBFS
      const y = ax <= 0.89 ? x : Math.sign(x) * (0.89 + 0.1 * Math.tanh((ax - 0.89) / 0.1));
      ch[i] = y;
      peak = Math.max(peak, Math.abs(y));
    }
  }
  await writeWav(outFile, { sampleRate: MIX_SR, channels: [L, R] });
  return { peak, duration: len / MIX_SR };
}
