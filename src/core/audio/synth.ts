import type { SfxType } from '../../shared/constants';
import type { AudioBuffer } from './wav';

/**
 * Original procedural music and sound effects. Everything here is synthesized
 * from oscillators and noise at runtime — no samples, no third-party recordings,
 * so there is nothing to license.
 */
export const SR = 44100;

/** Deterministic PRNG (mulberry32) so a project's music is reproducible. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/* ------------------------------------------------------------------ */
/* Music                                                               */
/* ------------------------------------------------------------------ */

// Chord progressions as scale-degree root offsets (semitones from key root) + quality.
type Chord = { root: number; minor: boolean };
const PROGRESSIONS: Chord[][] = [
  [{ root: 0, minor: true }, { root: 8, minor: false }, { root: 3, minor: false }, { root: 10, minor: false }],
  [{ root: 0, minor: true }, { root: 5, minor: true }, { root: 8, minor: false }, { root: 7, minor: false }],
  [{ root: 0, minor: true }, { root: 3, minor: false }, { root: 10, minor: false }, { root: 5, minor: true }],
  [{ root: 0, minor: false }, { root: 9, minor: true }, { root: 5, minor: false }, { root: 7, minor: false }],
];

export interface MusicOptions {
  durationSec: number;
  seed: number;
  /** 'calm' for educational, 'tense' adds darker pulse. */
  mood?: 'calm' | 'tense' | 'upbeat';
}

export function generateMusic(opts: MusicOptions): AudioBuffer {
  const rnd = prng(opts.seed);
  const bpm = opts.mood === 'upbeat' ? 96 : opts.mood === 'tense' ? 80 : 84 + Math.floor(rnd() * 8);
  const beat = 60 / bpm;
  const bar = beat * 4;
  const keyRoot = 45 + Math.floor(rnd() * 7); // A2..D#3
  const prog = PROGRESSIONS[Math.floor(rnd() * PROGRESSIONS.length)]!;
  const len = Math.ceil((opts.durationSec + 0.5) * SR);
  const L = new Float32Array(len);
  const R = new Float32Array(len);

  const chordAt = (t: number) => prog[Math.floor(t / (bar * 2)) % prog.length]!;
  const chordNotes = (c: Chord) => [c.root, c.root + (c.minor ? 3 : 4), c.root + 7, c.root + 12].map((x) => keyRoot + 12 + x);

  // Pad: soft additive voices per chord, crossfaded between chords.
  const chordLen = bar * 2;
  const numChords = Math.ceil(opts.durationSec / chordLen) + 1;
  for (let ci = 0; ci < numChords; ci++) {
    const c = prog[ci % prog.length]!;
    const notes = chordNotes(c);
    const t0 = ci * chordLen;
    const s0 = Math.floor(t0 * SR);
    const s1 = Math.min(len, Math.floor((t0 + chordLen + 0.8) * SR));
    for (let n = 0; n < notes.length; n++) {
      const f = midiHz(notes[n]!);
      const detune = 1 + (n % 2 ? 0.0025 : -0.0025);
      const pan = 0.5 + (n - 1.5) * 0.18;
      let ph1 = 0;
      let ph2 = 0;
      for (let s = s0; s < s1; s++) {
        const t = (s - s0) / SR;
        const env = Math.min(1, t / 0.9) * Math.min(1, Math.max(0, (chordLen + 0.8 - t) / 0.9));
        ph1 += (2 * Math.PI * f) / SR;
        ph2 += (2 * Math.PI * f * detune) / SR;
        const v = (Math.sin(ph1) + 0.35 * Math.sin(2 * ph1) + 0.12 * Math.sin(3 * ph1) + Math.sin(ph2) * 0.8) * 0.018 * env;
        L[s]! += v * (1 - pan);
        R[s]! += v * pan;
      }
    }
  }

  // Bass: plucked root on beats 1 and 3.
  const totalBeats = Math.ceil(opts.durationSec / beat);
  for (let b = 0; b < totalBeats; b++) {
    if (b % 2 !== 0) continue;
    const t0 = b * beat;
    const c = chordAt(t0);
    const f = midiHz(keyRoot + c.root);
    const s0 = Math.floor(t0 * SR);
    const dur = beat * 1.8;
    let ph = 0;
    for (let s = s0; s < Math.min(len, s0 + dur * SR); s++) {
      const t = (s - s0) / SR;
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 2.6);
      ph += (2 * Math.PI * f) / SR;
      const v = (Math.sin(ph) + 0.25 * Math.sin(2 * ph)) * 0.11 * env;
      L[s]! += v;
      R[s]! += v;
    }
  }

  // Drums: soft kick, light hats; starts after the intro bar.
  const noise = prng(opts.seed ^ 0x9e3779b9);
  for (let b = 4; b < totalBeats; b++) {
    const t0 = b * beat;
    const s0 = Math.floor(t0 * SR);
    if (b % 4 === 0 || (b % 4 === 2 && opts.mood !== 'calm')) {
      let ph = 0;
      for (let s = s0; s < Math.min(len, s0 + 0.32 * SR); s++) {
        const t = (s - s0) / SR;
        const f = 45 + 75 * Math.exp(-t * 28);
        ph += (2 * Math.PI * f) / SR;
        const v = Math.sin(ph) * Math.exp(-t * 9) * 0.16;
        L[s]! += v;
        R[s]! += v;
      }
    }
    for (let h = 0; h < 2; h++) {
      const hs = Math.floor((t0 + h * beat * 0.5) * SR);
      const amp = (h === 1 ? 0.016 : 0.009) * (opts.mood === 'upbeat' ? 1.4 : 1);
      let prev = 0;
      for (let s = hs; s < Math.min(len, hs + 0.05 * SR); s++) {
        const t = (s - hs) / SR;
        const w = noise() * 2 - 1;
        const hp = w - prev; // crude high-pass
        prev = w;
        const v = hp * Math.exp(-t * 70) * amp;
        L[s]! += v * 0.8;
        R[s]! += v * 1.2;
      }
    }
  }

  // Pluck arpeggio on 8ths in the second half of each chord.
  for (let e = 0; e < totalBeats * 2; e++) {
    const t0 = e * beat * 0.5;
    if (Math.floor(t0 / bar) % 2 === 0 || rnd() < 0.35) continue;
    const notes = chordNotes(chordAt(t0));
    const f = midiHz(notes[Math.floor(rnd() * notes.length)]! + 12);
    const s0 = Math.floor(t0 * SR);
    const pan = 0.3 + rnd() * 0.4;
    let ph = 0;
    for (let s = s0; s < Math.min(len, s0 + 0.6 * SR); s++) {
      const t = (s - s0) / SR;
      ph += (2 * Math.PI * f) / SR;
      const v = (Math.sin(ph) + 0.2 * Math.sin(3 * ph)) * Math.exp(-t * 6) * 0.03;
      L[s]! += v * (1 - pan);
      R[s]! += v * pan;
    }
  }

  // Global smoothing low-pass, fades, normalisation.
  lowpassInPlace(L, 5200);
  lowpassInPlace(R, 5200);
  const fadeIn = 1.2 * SR;
  const fadeOut = 2.0 * SR;
  let max = 0.001;
  for (let s = 0; s < len; s++) {
    const g = Math.min(1, s / fadeIn) * Math.min(1, (len - s) / fadeOut);
    L[s]! *= g;
    R[s]! *= g;
    max = Math.max(max, Math.abs(L[s]!), Math.abs(R[s]!));
  }
  const norm = 0.7 / max;
  for (let s = 0; s < len; s++) {
    L[s]! *= norm;
    R[s]! *= norm;
  }
  return { sampleRate: SR, channels: [L, R] };
}

function lowpassInPlace(x: Float32Array, cutoff: number): void {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    y += a * (x[i]! - y);
    x[i] = y;
  }
}

/* ------------------------------------------------------------------ */
/* Sound effects                                                       */
/* ------------------------------------------------------------------ */

function buffer(sec: number): Float32Array {
  return new Float32Array(Math.ceil(sec * SR));
}

function bell(out: Float32Array, start: number, freq: number, amp: number, decay: number): void {
  const partials = [1, 2.76, 5.4, 8.93];
  const gains = [1, 0.45, 0.22, 0.1];
  const s0 = Math.floor(start * SR);
  for (let p = 0; p < partials.length; p++) {
    const f = freq * partials[p]!;
    for (let s = s0; s < out.length; s++) {
      const t = (s - s0) / SR;
      out[s]! += Math.sin(2 * Math.PI * f * t) * amp * gains[p]! * Math.exp((-t * decay * (1 + p * 0.6)) / 1) * Math.min(1, t / 0.002);
    }
  }
}

function noiseBurst(out: Float32Array, start: number, dur: number, amp: number, rnd: () => number, cutoff = 4000): void {
  const s0 = Math.floor(start * SR);
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let s = s0; s < Math.min(out.length, s0 + dur * SR); s++) {
    const t = (s - s0) / SR;
    y += a * (rnd() * 2 - 1 - y);
    out[s]! += y * amp * Math.exp((-t * 5) / dur);
  }
}

/** Band-limited noise sweep through a state-variable filter. */
function sweep(out: Float32Array, start: number, dur: number, f0: number, f1: number, amp: number, rnd: () => number): void {
  const s0 = Math.floor(start * SR);
  let low = 0;
  let band = 0;
  const q = 0.7;
  for (let s = s0; s < Math.min(out.length, s0 + dur * SR); s++) {
    const t = (s - s0) / SR;
    const p = t / dur;
    const fc = f0 * (f1 / f0) ** p;
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);
    const input = rnd() * 2 - 1;
    low += f * band;
    const high = input - low - q * band;
    band += f * high;
    const env = Math.sin(Math.PI * Math.min(1, p)) ** 1.5;
    out[s]! += band * amp * env;
  }
}

function tone(out: Float32Array, start: number, dur: number, f0: number, f1: number, amp: number, decay = 8, shape: 'sine' | 'tri' = 'sine'): void {
  const s0 = Math.floor(start * SR);
  let ph = 0;
  for (let s = s0; s < Math.min(out.length, s0 + dur * SR); s++) {
    const t = (s - s0) / SR;
    const f = f0 * (f1 / f0) ** (t / dur);
    ph += (2 * Math.PI * f) / SR;
    const osc = shape === 'sine' ? Math.sin(ph) : (2 / Math.PI) * Math.asin(Math.sin(ph));
    out[s]! += osc * amp * Math.exp(-t * decay) * Math.min(1, t / 0.003);
  }
}

export function generateSfx(type: SfxType): AudioBuffer {
  const rnd = prng(seedFrom(type));
  let out: Float32Array;
  switch (type) {
    case 'whoosh':
      out = buffer(0.6);
      sweep(out, 0, 0.55, 300, 3200, 0.9, rnd);
      break;
    case 'swoosh':
      out = buffer(0.35);
      sweep(out, 0, 0.3, 1200, 6000, 0.7, rnd);
      break;
    case 'pop':
      out = buffer(0.15);
      tone(out, 0, 0.12, 900, 380, 0.7, 30);
      noiseBurst(out, 0, 0.01, 0.2, rnd, 8000);
      break;
    case 'impact':
      out = buffer(0.9);
      tone(out, 0, 0.8, 110, 34, 0.95, 4.5);
      noiseBurst(out, 0, 0.25, 0.5, rnd, 900);
      for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i]! * 1.6) * 0.8;
      break;
    case 'coin':
      out = buffer(0.6);
      bell(out, 0, 1975, 0.32, 9);
      bell(out, 0.07, 2637, 0.26, 10);
      break;
    case 'cash':
      out = buffer(1.0);
      noiseBurst(out, 0, 0.04, 0.4, rnd, 6000);
      bell(out, 0.03, 1568, 0.3, 6);
      bell(out, 0.03, 1976, 0.22, 6);
      for (let k = 0; k < 5; k++) bell(out, 0.18 + k * 0.06 + rnd() * 0.02, 2200 + rnd() * 900, 0.08, 14);
      break;
    case 'tick':
      out = buffer(0.6);
      noiseBurst(out, 0, 0.012, 0.6, rnd, 9000);
      tone(out, 0, 0.03, 2400, 2400, 0.25, 120);
      noiseBurst(out, 0.3, 0.012, 0.45, rnd, 6000);
      tone(out, 0.3, 0.03, 1800, 1800, 0.22, 120);
      break;
    case 'riser':
      out = buffer(1.3);
      sweep(out, 0, 1.25, 200, 5000, 0.5, rnd);
      tone(out, 0, 1.25, 180, 900, 0.18, 0.2, 'tri');
      for (let i = 0; i < out.length; i++) out[i]! *= Math.min(1, i / out.length + 0.15);
      break;
    case 'ding':
      out = buffer(1.2);
      bell(out, 0, 1318.5, 0.45, 3.5);
      break;
    case 'fail':
      out = buffer(0.9);
      tone(out, 0, 0.32, 440, 400, 0.35, 2, 'tri');
      tone(out, 0.36, 0.5, 370, 260, 0.35, 2.2, 'tri');
      break;
    case 'typing':
      out = buffer(0.7);
      for (let k = 0; k < 7; k++) noiseBurst(out, k * 0.085 + rnd() * 0.02, 0.015, 0.35, rnd, 5000);
      break;
    case 'heartbeat':
      out = buffer(0.8);
      tone(out, 0, 0.18, 70, 45, 0.9, 14);
      tone(out, 0.22, 0.18, 65, 42, 0.7, 14);
      break;
  }
  // Short fades to avoid clicks.
  const f = Math.floor(0.004 * SR);
  for (let i = 0; i < f && i < out.length; i++) {
    out[i]! *= i / f;
    out[out.length - 1 - i]! *= i / f;
  }
  return { sampleRate: SR, channels: [out] };
}
