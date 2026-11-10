import fsp from 'node:fs/promises';
import { writeFileAtomic } from '../util/fsx';

export interface AudioBuffer {
  sampleRate: number;
  /** One Float32Array per channel, samples in [-1, 1]. */
  channels: Float32Array[];
}

export function duration(buf: AudioBuffer): number {
  return (buf.channels[0]?.length ?? 0) / buf.sampleRate;
}

/** Encode as 16-bit PCM WAV. */
export function encodeWav(buf: AudioBuffer): Buffer {
  const numCh = buf.channels.length;
  const len = buf.channels[0]?.length ?? 0;
  const data = Buffer.alloc(len * numCh * 2);
  let o = 0;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const v = Math.max(-1, Math.min(1, buf.channels[c]![i]!));
      data.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), o);
      o += 2;
    }
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numCh, 22);
  header.writeUInt32LE(buf.sampleRate, 24);
  header.writeUInt32LE(buf.sampleRate * numCh * 2, 28);
  header.writeUInt16LE(numCh * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Decode PCM16 / PCM24 / PCM32 / float32 WAV. */
export function decodeWav(bytes: Buffer): AudioBuffer {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Not a WAV file');
  let pos = 12;
  let fmt: { format: number; channels: number; sampleRate: number; bits: number } | undefined;
  let dataStart = -1;
  let dataLen = 0;
  while (pos + 8 <= bytes.length) {
    const id = bytes.toString('ascii', pos, pos + 4);
    const size = bytes.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      let format = bytes.readUInt16LE(body);
      const channels = bytes.readUInt16LE(body + 2);
      const sampleRate = bytes.readUInt32LE(body + 4);
      const bits = bytes.readUInt16LE(body + 14);
      if (format === 0xfffe && size >= 26) format = bytes.readUInt16LE(body + 24);
      fmt = { format, channels, sampleRate, bits };
    } else if (id === 'data') {
      dataStart = body;
      // Streams written to pipes may carry 0 / 0xFFFFFFFF sizes.
      dataLen = size === 0 || size === 0xffffffff || body + size > bytes.length ? bytes.length - body : size;
      break;
    }
    pos = body + size + (size % 2);
  }
  if (!fmt || dataStart < 0) throw new Error('Invalid WAV: missing fmt or data chunk');
  const bytesPerSample = fmt.bits / 8;
  const frames = Math.floor(dataLen / (bytesPerSample * fmt.channels));
  const channels = Array.from({ length: fmt.channels }, () => new Float32Array(frames));
  let o = dataStart;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.channels; c++) {
      let v: number;
      if (fmt.format === 3 && fmt.bits === 32) v = bytes.readFloatLE(o);
      else if (fmt.bits === 16) v = bytes.readInt16LE(o) / 32768;
      else if (fmt.bits === 24) v = bytes.readIntLE(o, 3) / 8388608;
      else if (fmt.bits === 32) v = bytes.readInt32LE(o) / 2147483648;
      else if (fmt.bits === 8) v = (bytes.readUInt8(o) - 128) / 128;
      else throw new Error(`Unsupported WAV bit depth ${fmt.bits}`);
      channels[c]![i] = v;
      o += bytesPerSample;
    }
  }
  return { sampleRate: fmt.sampleRate, channels };
}

export async function readWav(file: string): Promise<AudioBuffer> {
  return decodeWav(await fsp.readFile(file));
}

export async function writeWav(file: string, buf: AudioBuffer): Promise<void> {
  await writeFileAtomic(file, encodeWav(buf));
}

export function toMono(buf: AudioBuffer): Float32Array {
  if (buf.channels.length === 1) return buf.channels[0]!;
  const len = buf.channels[0]!.length;
  const out = new Float32Array(len);
  for (const ch of buf.channels) for (let i = 0; i < len; i++) out[i]! += ch[i]! / buf.channels.length;
  return out;
}

/** Linear-interpolation resampler (adequate for speech/SFX placement). */
export function resample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return samples;
  const ratio = from / to;
  const outLen = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const t = x - i0;
    out[i] = (samples[i0] ?? 0) * (1 - t) + (samples[i1] ?? 0) * t;
  }
  return out;
}

export function peak(samples: Float32Array): number {
  let m = 0;
  for (let i = 0; i < samples.length; i++) m = Math.max(m, Math.abs(samples[i]!));
  return m;
}

export function rms(samples: Float32Array, start = 0, end = samples.length): number {
  let s = 0;
  const n = Math.max(1, end - start);
  for (let i = start; i < end; i++) s += samples[i]! * samples[i]!;
  return Math.sqrt(s / n);
}

/** Trim leading/trailing near-silence, keeping a small pad. */
export function trimSilence(samples: Float32Array, sampleRate: number, threshold = 0.01, padSec = 0.04): Float32Array {
  const pad = Math.round(padSec * sampleRate);
  let a = 0;
  while (a < samples.length && Math.abs(samples[a]!) < threshold) a++;
  let b = samples.length - 1;
  while (b > a && Math.abs(samples[b]!) < threshold) b--;
  if (a >= b) return samples;
  return samples.slice(Math.max(0, a - pad), Math.min(samples.length, b + pad));
}
