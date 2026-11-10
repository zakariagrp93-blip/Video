import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar';
import type { Language, NarratorOption } from '../../../../shared/constants';
import { decodeWav, encodeWav } from '../../../audio/wav';
import { splitClauses } from '../../../text/speech';
import { ProviderError, throwIfAborted } from '../../../util/errors';
import { ensureDir, exists, safeJoin } from '../../../util/fsx';
import { hashOf } from '../../../util/hash';
import { downloadToBuffer } from '../../../util/http';
import type { ConnectionTestResult, ProviderContext, SynthesisRequest, SynthesisResult, TTSProvider, VoiceInfo } from '../../types';
import { phonemizeClause } from './phonemizer';
import { PIPER_VOICES, defaultPiperVoice, type PiperVoiceSpec } from './voices';

type Ort = typeof import('onnxruntime-node');

interface PiperConfig {
  audio: { sample_rate: number };
  espeak: { voice: string };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
  phoneme_id_map: Record<string, number[]>;
  num_speakers?: number;
}

interface LoadedVoice {
  config: PiperConfig;
  session: import('onnxruntime-node').InferenceSession;
}

const ENGINE_VERSION = 'piper-js-1';

/**
 * Local neural TTS: Piper voice models executed with ONNX Runtime, phonemes from
 * eSpeak-NG (WASM). Runs fully offline once a voice is downloaded; zero API cost.
 */
export class PiperTTSProvider implements TTSProvider {
  readonly id = 'piper';
  readonly label = 'Piper (local neural voices)';
  readonly isLocal = true;
  private loaded = new Map<string, Promise<LoadedVoice>>();
  private ort: Ort | undefined;

  constructor(
    private readonly voicesDir: string,
    private readonly voiceOverrides: () => Record<string, string>,
  ) {}

  checkReady(language: Language): string | null {
    return PIPER_VOICES.some((v) => v.language === language) ? null : `No Piper voice available for ${language}.`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.loadOrt();
      const installed = (await this.listVoices()).filter((v) => v.installed).length;
      return { ok: true, message: `ONNX Runtime ready. ${installed} voice(s) installed; missing voices download automatically on first use.` };
    } catch (err) {
      return { ok: false, message: `ONNX Runtime could not be loaded: ${(err as Error).message}` };
    }
  }

  private voiceDir(id: string): string {
    return safeJoin(this.voicesDir, id);
  }

  private modelPath(v: PiperVoiceSpec): string {
    return path.join(this.voiceDir(v.id), `${v.modelName}.onnx`);
  }

  async isInstalled(v: PiperVoiceSpec): Promise<boolean> {
    return (await exists(this.modelPath(v))) && (await exists(`${this.modelPath(v)}.json`));
  }

  async listVoices(language?: Language): Promise<VoiceInfo[]> {
    const list = PIPER_VOICES.filter((v) => !language || v.language === language);
    return Promise.all(
      list.map(async (v) => ({ id: v.id, label: v.label, language: v.language, gender: v.gender, sizeMb: v.sizeMb, installed: await this.isInstalled(v) })),
    );
  }

  async resolveVoice(language: Language, narrator: NarratorOption): Promise<VoiceInfo> {
    const overrideId = this.voiceOverrides()[`${language}-${narrator}`] ?? (narrator === 'auto' ? this.voiceOverrides()[language] : undefined);
    const spec = PIPER_VOICES.find((v) => v.id === overrideId && v.language === language) ?? defaultPiperVoice(language, narrator);
    return { id: spec.id, label: spec.label, language: spec.language, gender: spec.gender, installed: await this.isInstalled(spec) };
  }

  /** Download + extract a voice archive from the official Piper release. */
  async prepareVoice(voice: VoiceInfo, ctx: ProviderContext, onProgress?: (fraction: number) => void): Promise<void> {
    const spec = PIPER_VOICES.find((v) => v.id === voice.id);
    if (!spec) throw new ProviderError('piper', `Unknown voice ${voice.id}`);
    if (await this.isInstalled(spec)) return;
    ctx.log.info(`Downloading Piper voice ${spec.id} (${spec.sizeMb} MB)…`);
    const data = await downloadToBuffer(spec.archiveUrl, { signal: ctx.signal, onProgress, maxBytes: 400 * 1024 * 1024 });
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'fvs-voice-'));
    try {
      await pipeline(Readable.from(data), tar.x({ cwd: tmpDir, strict: true, filter: (p) => !p.includes('..') }));
      const files = await fsp.readdir(tmpDir);
      const onnx = files.find((f) => f.endsWith('.onnx'));
      const json = files.find((f) => f.endsWith('.onnx.json'));
      if (!onnx || !json) throw new ProviderError('piper', `Voice archive for ${spec.id} is missing model files.`);
      const config = JSON.parse(await fsp.readFile(path.join(tmpDir, json), 'utf8')) as PiperConfig;
      if (!config.phoneme_id_map || !config.audio?.sample_rate) throw new ProviderError('piper', 'Voice config is invalid.');
      const dest = this.voiceDir(spec.id);
      await ensureDir(dest);
      await fsp.copyFile(path.join(tmpDir, onnx), path.join(dest, `${spec.modelName}.onnx`));
      await fsp.copyFile(path.join(tmpDir, json), path.join(dest, `${spec.modelName}.onnx.json`));
      const card = files.find((f) => f.toUpperCase().includes('MODEL_CARD'));
      if (card) await fsp.copyFile(path.join(tmpDir, card), path.join(dest, 'MODEL_CARD'));
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    }
  }

  private async loadOrt(): Promise<Ort> {
    this.ort ??= (await import('onnxruntime-node')) as Ort;
    return this.ort;
  }

  private loadVoice(spec: PiperVoiceSpec): Promise<LoadedVoice> {
    let p = this.loaded.get(spec.id);
    if (!p) {
      p = (async () => {
        const ort = await this.loadOrt();
        const model = this.modelPath(spec);
        const config = JSON.parse(await fsp.readFile(`${model}.json`, 'utf8')) as PiperConfig;
        const session = await ort.InferenceSession.create(model, { executionProviders: ['cpu'], graphOptimizationLevel: 'all' });
        return { config, session };
      })();
      p.catch(() => this.loaded.delete(spec.id));
      this.loaded.set(spec.id, p);
    }
    return p;
  }

  /** Convert text into Piper phoneme ids (BOS, phoneme+pad…, EOS) — mirrors piper-phonemize. */
  async textToIds(text: string, config: PiperConfig): Promise<number[]> {
    const map = config.phoneme_id_map;
    const pad = map['_']?.[0] ?? 0;
    const ids: number[] = [...(map['^'] ?? [1]), pad];
    const clauses = splitClauses(text);
    for (let i = 0; i < clauses.length; i++) {
      const c = clauses[i]!;
      const phonemes = await phonemizeClause(c.text, config.espeak.voice);
      const last = i === clauses.length - 1;
      const punct = (c.punct || (last ? '.' : ',')).replace('…', '.').slice(0, 1);
      const seq = `${phonemes}${punct}${last ? '' : ' '}`;
      for (const ch of [...seq]) {
        const id = map[ch];
        if (!id) continue; // phonemes the voice was not trained on (e.g. combining marks) are skipped, as in piper
        ids.push(...id, pad);
      }
    }
    ids.push(...(map['$'] ?? [2]));
    return ids;
  }

  async synthesize(req: SynthesisRequest, ctx: ProviderContext): Promise<SynthesisResult> {
    const spec = PIPER_VOICES.find((v) => v.id === req.voiceId);
    if (!spec) throw new ProviderError('piper', `Unknown voice ${req.voiceId}`);
    const key = hashOf({ e: ENGINE_VERSION, v: spec.id, t: req.text, s: req.speed }, 32);
    const cached = await ctx.cache.get('tts', key, 'wav');
    if (cached) {
      const buf = decodeWav(await fsp.readFile(cached));
      ctx.usage({ provider: 'piper', kind: 'tts', units: req.text.length, unitType: 'characters', cached: true });
      return { samples: buf.channels[0]!, sampleRate: buf.sampleRate, alignment: 'none', cached: true };
    }
    if (!(await this.isInstalled(spec))) await this.prepareVoice(spec, ctx);
    throwIfAborted(ctx.signal);
    const { config, session } = await this.loadVoice(spec);
    const ort = await this.loadOrt();
    const ids = await this.textToIds(req.text, config);
    if (ids.length < 5) throw new ProviderError('piper', `Nothing to synthesize for: "${req.text}"`);
    const lengthScale = config.inference.length_scale / Math.max(0.5, req.speed);
    const feeds: Record<string, import('onnxruntime-node').Tensor> = {
      input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor('float32', Float32Array.from([config.inference.noise_scale, lengthScale, config.inference.noise_w]), [3]),
    };
    if (session.inputNames.includes('sid')) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
    const out = await session.run(feeds);
    const raw = out[session.outputNames[0]!]!.data as Float32Array;
    // Peak-normalise like piper does, leaving headroom.
    let max = 0.01;
    for (let i = 0; i < raw.length; i++) max = Math.max(max, Math.abs(raw[i]!));
    const samples = new Float32Array(raw.length);
    const gain = 0.92 / max;
    for (let i = 0; i < raw.length; i++) samples[i] = raw[i]! * gain;
    const sampleRate = config.audio.sample_rate;
    await ctx.cache.put('tts', key, 'wav', encodeWav({ sampleRate, channels: [samples] }), 'piper');
    ctx.usage({ provider: 'piper', kind: 'tts', units: req.text.length, unitType: 'characters' });
    return { samples, sampleRate, alignment: 'none', cached: false };
  }
}

export function piperVoicesInstalledSync(voicesDir: string): string[] {
  return PIPER_VOICES.filter((v) => fs.existsSync(path.join(voicesDir, v.id, `${v.modelName}.onnx`))).map((v) => v.id);
}
