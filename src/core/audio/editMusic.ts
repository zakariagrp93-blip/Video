import { prng, SR } from './synth';
import type { AudioBuffer } from './wav';

/**
 * Original procedural soundtracks for motivation edits — synthesized from
 * oscillators and noise, no samples. A beat grid is exposed so cuts, pulses
 * and the drop line up with the music.
 */
export type EditStyle = 'phonk' | 'epic' | 'piano';

export interface BeatGrid {
  bpm: number;
  /** Time (s) of a bar downbeat; the grid is offset + k × beat. */
  offset: number;
  /** Where the drop (full drums) starts — a bar boundary. */
  dropAt: number;
}

export function editBpm(style: EditStyle, seed: number): number {
  const rnd = prng(seed ^ 0x51ed);
  if (style === 'phonk') return 128 + Math.floor(rnd() * 10);
  if (style === 'epic') return 88 + Math.floor(rnd() * 8);
  return 70 + Math.floor(rnd() * 8);
}

/** Beat grid placing a bar line exactly on the drop. */
export function beatGrid(style: EditStyle, seed: number, dropAt: number): BeatGrid {
  const bpm = editBpm(style, seed);
  const bar = (60 / bpm) * 4;
  const offset = dropAt - Math.floor(dropAt / bar) * bar;
  return { bpm, offset, dropAt };
}

/** Snap a time to the nearest half beat when that moves it by at most [-maxEarly, +maxLate] seconds. */
export function snapToGrid(t: number, grid: BeatGrid, maxEarly = 0.24, maxLate = 0.06): number {
  const half = 60 / grid.bpm / 2;
  const k = Math.round((t - grid.offset) / half);
  const snapped = grid.offset + k * half;
  const d = snapped - t;
  return d >= -maxEarly && d <= maxLate ? snapped : t;
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface Bus {
  L: Float32Array;
  R: Float32Array;
}

function add(bus: Bus, start: number, dur: number, gen: (t: number, i: number) => number, pan = 0.5): void {
  const s0 = Math.max(0, Math.floor(start * SR));
  const s1 = Math.min(bus.L.length, Math.floor((start + dur) * SR));
  const gl = Math.cos((pan * Math.PI) / 2) * Math.SQRT2;
  const gr = Math.sin((pan * Math.PI) / 2) * Math.SQRT2;
  for (let s = s0; s < s1; s++) {
    const v = gen((s - s0) / SR, s);
    bus.L[s]! += v * gl;
    bus.R[s]! += v * gr;
  }
}

function lowpass(x: Float32Array, cutoff: number): void {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    y += a * (x[i]! - y);
    x[i] = y;
  }
}

/** Small Schroeder/Freeverb-style reverb, in place, returns nothing. */
export function reverbInPlace(L: Float32Array, R: Float32Array, sr: number, wet = 0.25, size = 0.84, damp = 0.25): void {
  const scale = sr / 44100;
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => Math.round(d * scale));
  const aps = [556, 441, 341].map((d) => Math.round(d * scale));
  const process = (x: Float32Array, spread: number): Float32Array => {
    const out = new Float32Array(x.length);
    for (const base of combs) {
      const d = base + spread;
      const buf = new Float32Array(d);
      let idx = 0;
      let filt = 0;
      for (let i = 0; i < x.length; i++) {
        const y = buf[idx]!;
        filt = y * (1 - damp) + filt * damp;
        buf[idx] = x[i]! * 0.015 + filt * size;
        out[i]! += y;
        idx = idx + 1 === d ? 0 : idx + 1;
      }
    }
    for (const base of aps) {
      const d = base + spread;
      const buf = new Float32Array(d);
      let idx = 0;
      for (let i = 0; i < out.length; i++) {
        const b = buf[idx]!;
        const y = -out[i]! + b;
        buf[idx] = out[i]! + b * 0.5;
        out[i] = y;
        idx = idx + 1 === d ? 0 : idx + 1;
      }
    }
    return out;
  };
  const mono = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) mono[i] = (L[i]! + R[i]!) * 0.5;
  const wl = process(mono, 0);
  const wr = process(mono, 23);
  for (let i = 0; i < L.length; i++) {
    L[i] = L[i]! * (1 - wet * 0.5) + wl[i]! * wet;
    R[i] = R[i]! * (1 - wet * 0.5) + wr[i]! * wet;
  }
}

/* ------------------------------------------------------------------ */
/* Instruments                                                          */
/* ------------------------------------------------------------------ */

function kick(bus: Bus, t0: number, amp = 1): void {
  let ph = 0;
  add(bus, t0, 0.42, (t) => {
    const f = 42 + 120 * Math.exp(-t * 32);
    ph += (2 * Math.PI * f) / SR;
    const click = t < 0.004 ? (1 - t / 0.004) * 0.4 : 0;
    return (Math.tanh(Math.sin(ph) * 2.2) * Math.exp(-t * 7.5) + click) * 0.42 * amp;
  });
}

function noiseHit(bus: Bus, t0: number, dur: number, decay: number, amp: number, rnd: () => number, hp = 0.85, pan = 0.5): void {
  let prev = 0;
  let lp = 0;
  add(
    bus,
    t0,
    dur,
    (t) => {
      const w = rnd() * 2 - 1;
      const h = w - prev * hp;
      prev = w;
      lp += 0.5 * (h - lp);
      return lp * Math.exp(-t * decay) * amp;
    },
    pan,
  );
}

function clap(bus: Bus, t0: number, rnd: () => number, amp = 1): void {
  for (const d of [0, 0.011, 0.022]) noiseHit(bus, t0 + d, 0.03, 90, 0.22 * amp, rnd, 0.6);
  noiseHit(bus, t0 + 0.03, 0.32, 13, 0.16 * amp, rnd, 0.6);
}

function hat(bus: Bus, t0: number, rnd: () => number, amp = 1, open = false): void {
  noiseHit(bus, t0, open ? 0.22 : 0.05, open ? 16 : 75, 0.07 * amp, rnd, 0.98, 0.62);
}

/** Phonk-style cowbell: two detuned square-ish tones, short decay. */
function cowbell(bus: Bus, t0: number, midi: number, amp = 1, pan = 0.5): void {
  const f1 = midiHz(midi);
  const f2 = f1 * 1.483;
  let p1 = 0;
  let p2 = 0;
  add(
    bus,
    t0,
    0.32,
    (t) => {
      p1 += (2 * Math.PI * f1) / SR;
      p2 += (2 * Math.PI * f2) / SR;
      const sq = Math.tanh(Math.sin(p1) * 4) * 0.6 + Math.tanh(Math.sin(p2) * 4) * 0.4;
      return sq * Math.exp(-t * 11) * 0.075 * amp;
    },
    pan,
  );
}

/** Distorted 808 with a glide from the previous note. */
function bass808(bus: Bus, t0: number, dur: number, midi: number, fromMidi: number | null, amp = 1): void {
  const f = midiHz(midi);
  const f0 = fromMidi === null ? f : midiHz(fromMidi);
  let ph = 0;
  add(bus, t0, dur + 0.05, (t) => {
    const g = Math.min(1, t / 0.07);
    const freq = f0 + (f - f0) * g;
    ph += (2 * Math.PI * freq) / SR;
    const env = Math.min(1, t / 0.005) * Math.exp(-t * 1.1) * Math.min(1, Math.max(0, (dur + 0.05 - t) / 0.05));
    return Math.tanh(Math.sin(ph) * 2.6) * env * 0.3 * amp;
  });
}

function pad(bus: Bus, t0: number, dur: number, notes: number[], amp: number, bright = 0.3): void {
  notes.forEach((m, n) => {
    const f = midiHz(m);
    let a = 0;
    let b = 0;
    let c = 0;
    add(
      bus,
      t0,
      dur + 0.6,
      (t) => {
        a += (2 * Math.PI * f) / SR;
        b += (2 * Math.PI * f * 1.004) / SR;
        c += (2 * Math.PI * f * 0.996) / SR;
        const saw = (x: number) => ((x / (2 * Math.PI)) % 1) * 2 - 1;
        const v = Math.sin(a) * (1 - bright) + (saw(a) + saw(b) + saw(c)) * (bright / 3);
        const env = Math.min(1, t / 0.5) * Math.min(1, Math.max(0, (dur + 0.6 - t) / 0.6));
        return v * env * amp;
      },
      0.3 + (n % 4) * 0.13,
    );
  });
}

function pianoNote(bus: Bus, t0: number, midi: number, amp: number, pan = 0.5): void {
  const f = midiHz(midi);
  const partials = [1, 2, 3, 4.02, 5.05];
  const gains = [1, 0.45, 0.22, 0.1, 0.05];
  const ph = partials.map(() => 0);
  add(
    bus,
    t0,
    2.6,
    (t) => {
      let v = 0;
      for (let k = 0; k < partials.length; k++) {
        ph[k]! += (2 * Math.PI * f * partials[k]!) / SR;
        v += Math.sin(ph[k]!) * gains[k]! * Math.exp(-t * (1.6 + k * 1.3));
      }
      return v * Math.min(1, t / 0.004) * 0.09 * amp;
    },
    pan,
  );
}

function taiko(bus: Bus, t0: number, rnd: () => number, amp = 1): void {
  let ph = 0;
  add(bus, t0, 0.9, (t) => {
    const f = 55 + 70 * Math.exp(-t * 18);
    ph += (2 * Math.PI * f) / SR;
    return Math.sin(ph) * Math.exp(-t * 4.2) * 0.45 * amp;
  });
  noiseHit(bus, t0, 0.12, 40, 0.1 * amp, rnd, 0.3);
}

function braam(bus: Bus, t0: number, root: number, amp = 1): void {
  for (const m of [root - 12, root - 5, root]) {
    const f = midiHz(m);
    let a = 0;
    let lp = 0;
    add(bus, t0, 3.2, (t) => {
      a += (2 * Math.PI * f) / SR;
      const saw = ((a / (2 * Math.PI)) % 1) * 2 - 1;
      const cut = 0.02 + 0.2 * Math.exp(-t * 1.5);
      lp += cut * (saw - lp);
      return lp * Math.min(1, t / 0.04) * Math.exp(-t * 0.8) * 0.2 * amp;
    });
  }
}

function riser(bus: Bus, end: number, dur: number, rnd: () => number, amp = 1): void {
  let lp = 0;
  add(bus, end - dur, dur, (t) => {
    const p = t / dur;
    const w = rnd() * 2 - 1;
    lp += (0.02 + 0.5 * p * p) * (w - lp);
    return lp * p * p * 0.35 * amp;
  });
}

function boom(bus: Bus, t0: number, rnd: () => number): void {
  let ph = 0;
  add(bus, t0, 2.2, (t) => {
    const f = 30 + 60 * Math.exp(-t * 9);
    ph += (2 * Math.PI * f) / SR;
    return Math.tanh(Math.sin(ph) * 1.6) * Math.exp(-t * 1.8) * 0.5;
  });
  noiseHit(bus, t0, 1.6, 2.6, 0.12, rnd, 0.4);
}

/* ------------------------------------------------------------------ */

const MINOR_PROGS = [
  [0, 8, 3, 10],
  [0, 5, 8, 7],
  [0, 10, 8, 7],
  [0, 3, 8, 10],
];

export interface EditMusicOptions {
  durationSec: number;
  seed: number;
  style: EditStyle;
  grid: BeatGrid;
}

export function generateEditMusic(opts: EditMusicOptions): AudioBuffer {
  const { grid, style } = opts;
  const rnd = prng(opts.seed);
  const noise = prng(opts.seed ^ 0x9e3779b9);
  const len = Math.ceil((opts.durationSec + 0.5) * SR);
  const bus: Bus = { L: new Float32Array(len), R: new Float32Array(len) };
  const fx: Bus = { L: new Float32Array(len), R: new Float32Array(len) }; // sent to reverb
  const beat = 60 / grid.bpm;
  const bar = beat * 4;
  const prog = MINOR_PROGS[Math.floor(rnd() * MINOR_PROGS.length)]!;
  const key = 33 + Math.floor(rnd() * 6); // A1..D2 (bass register)
  const firstBar = Math.floor((0 - grid.offset) / bar) - 1;
  const lastBar = Math.ceil((opts.durationSec - grid.offset) / bar);
  const dropBar = Math.round((grid.dropAt - grid.offset) / bar);
  const chordOf = (b: number) => prog[(((b - dropBar) % 4) + 4) % 4]!;
  const minor = (root: number) => [root, root + 3, root + 7];
  const end = opts.durationSec;

  for (let b = firstBar; b <= lastBar; b++) {
    const t = grid.offset + b * bar;
    if (t > end) break;
    const root = key + chordOf(b);
    const afterDrop = b >= dropBar;
    // A breakdown bar every 8 bars keeps it breathing.
    const breakdown = afterDrop && (b - dropBar) % 8 === 7;
    if (style === 'phonk') {
      pad(fx, t, bar, minor(root + 24).concat(root + 36), afterDrop ? 0.016 : 0.022, 0.25);
      if (!afterDrop || breakdown) {
        for (let s = 0; s < 8; s++) if (s % 3 === 0) cowbell(fx, t + s * beat * 0.5, root + 36 + [0, 3, 7][s % 3]!, 0.35, 0.65);
        continue;
      }
      const kicks = [0, 1.5, 2.5];
      for (const k of kicks) kick(bus, t + k * beat, k === 0 ? 1 : 0.8);
      clap(bus, t + beat, noise);
      clap(bus, t + 3 * beat, noise);
      for (let s = 0; s < 8; s++) hat(bus, t + s * beat * 0.5, noise, s % 2 ? 0.6 : 1);
      if ((b - dropBar) % 2 === 1) for (let s = 0; s < 3; s++) hat(bus, t + 3.5 * beat + (s * beat) / 6, noise, 0.5);
      bass808(bus, t, beat * 1.4, root, null);
      bass808(bus, t + beat * 1.5, beat * 0.9, root + 12, root);
      bass808(bus, t + beat * 2.5, beat * 1.4, root + (prog.includes(7) ? 7 : 3), root + 12);
      // Cowbell hook: a 16-step figure on the minor pentatonic.
      const scale = [0, 3, 5, 7, 10, 12];
      const figure = [0, -1, -1, 2, -1, -1, 3, -1, 4, -1, -1, 3, -1, 2, -1, 1];
      figure.forEach((deg, s) => {
        if (deg < 0) return;
        cowbell(bus, t + (s * beat) / 4, key + 36 + chordOf(b) * 0 + scale[deg]! + (b % 2 && s > 11 ? 2 : 0), 1, 0.4 + (s % 4) * 0.08);
      });
    } else if (style === 'epic') {
      pad(fx, t, bar, minor(root + 12).concat(root + 24), afterDrop ? 0.03 : 0.022, 0.55);
      if (afterDrop && !breakdown) {
        for (const k of [0, 0.75, 1.5, 2, 3, 3.5]) taiko(bus, t + k * beat, noise, k === 0 || k === 2 ? 1 : 0.6);
        clap(fx, t + 2 * beat, noise, 0.9);
        for (let s = 0; s < 8; s++) {
          const m = minor(root + 24)[s % 3]! + (s >= 4 ? 12 : 0);
          pianoNote(bus, t + s * beat * 0.5, m, 0.9, 0.35 + (s % 3) * 0.15);
        }
        bass808(bus, t, bar * 0.95, root, null, 0.6);
        if ((b - dropBar) % 4 === 0) braam(fx, t, root + 12, 0.9);
      } else {
        for (let s = 0; s < 4; s++) pianoNote(fx, t + s * beat, minor(root + 24)[s % 3]!, 0.7);
      }
    } else {
      // piano
      pad(fx, t, bar, minor(root + 24), afterDrop ? 0.018 : 0.012, 0.15);
      pianoNote(bus, t, root + 12, 1.1, 0.45);
      for (let s = 0; s < 8; s++) {
        const m = [0, 7, 12, 15, 19, 15, 12, 7][s]!;
        pianoNote(bus, t + s * beat * 0.5, root + 24 + m, s === 0 ? 0.9 : 0.6, 0.35 + ((s * 0.11) % 0.4));
      }
      if (afterDrop && !breakdown) {
        kick(bus, t, 0.55);
        kick(bus, t + 2 * beat, 0.45);
        clap(fx, t + beat, noise, 0.35);
        clap(fx, t + 3 * beat, noise, 0.35);
      }
    }
  }
  // The drop: a riser into it, then a sub boom.
  riser(fx, grid.dropAt, Math.min(grid.dropAt, bar), noise, style === 'piano' ? 0.5 : 1);
  if (grid.dropAt > 0.3) boom(bus, grid.dropAt, noise);

  reverbInPlace(fx.L, fx.R, SR, style === 'phonk' ? 0.35 : 0.55, 0.86, 0.3);
  for (let i = 0; i < len; i++) {
    bus.L[i]! += fx.L[i]!;
    bus.R[i]! += fx.R[i]!;
  }
  lowpass(bus.L, 9000);
  lowpass(bus.R, 9000);
  // Glue: soft saturation, fades, normalisation.
  const fadeIn = 0.08 * SR;
  const fadeOut = 1.6 * SR;
  let max = 0.001;
  for (let i = 0; i < len; i++) {
    const g = Math.min(1, i / fadeIn) * Math.min(1, (len - i) / fadeOut);
    bus.L[i] = Math.tanh(bus.L[i]! * 1.4) * g;
    bus.R[i] = Math.tanh(bus.R[i]! * 1.4) * g;
    max = Math.max(max, Math.abs(bus.L[i]!), Math.abs(bus.R[i]!));
  }
  const norm = 0.8 / max;
  for (let i = 0; i < len; i++) {
    bus.L[i]! *= norm;
    bus.R[i]! *= norm;
  }
  return { sampleRate: SR, channels: [bus.L, bus.R] };
}
