import fsp from 'node:fs/promises';
import OpenAI from 'openai';
import { LANGUAGE_LABELS, type Language, type NarratorOption } from '../../../shared/constants';
import { decodeWav, toMono } from '../../audio/wav';
import { ProviderError } from '../../util/errors';
import { hashOf } from '../../util/hash';
import { getFetchImplementation } from '../../util/http';
import type { ConnectionTestResult, ProviderContext, SynthesisRequest, SynthesisResult, TTSProvider, VoiceInfo } from '../types';

const VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'];

/** OpenAI speech API. Returns no timestamps — subtitles use silence-anchored alignment. */
export class OpenAITTSProvider implements TTSProvider {
  readonly id = 'openai';
  readonly label = 'OpenAI TTS';
  readonly isLocal = false;

  constructor(
    private readonly apiKey: () => string | undefined,
    private readonly model: () => string,
    private readonly voices: () => { male: string; female: string },
  ) {}

  private client(): OpenAI {
    const key = this.apiKey();
    if (!key) throw new ProviderError('openai', 'API key not configured');
    return new OpenAI({ apiKey: key, fetch: getFetchImplementation() as never, maxRetries: 0 });
  }

  checkReady(): string | null {
    return this.apiKey() ? null : 'OpenAI API key is not set (Settings → API keys).';
  }

  async testConnection(ctx: ProviderContext): Promise<ConnectionTestResult> {
    if (!this.apiKey()) return { ok: false, message: 'No API key configured.' };
    try {
      await this.client().models.retrieve(this.model(), { signal: ctx.signal });
      return { ok: true, message: `Connected. Model ${this.model()} is available.` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  async listVoices(language?: Language): Promise<VoiceInfo[]> {
    return VOICES.map((id) => ({ id, label: id, language: language ?? 'en', gender: 'unspecified' as const }));
  }

  async resolveVoice(language: Language, narrator: NarratorOption): Promise<VoiceInfo> {
    const v = this.voices();
    const id = narrator === 'male' ? v.male : v.female;
    return { id: id || 'nova', label: id || 'nova', language, gender: narrator === 'male' ? 'male' : 'female' };
  }

  async synthesize(req: SynthesisRequest, ctx: ProviderContext): Promise<SynthesisResult> {
    const model = this.model();
    const key = hashOf({ p: 'openai', m: model, v: req.voiceId, t: req.text, s: req.speed, l: req.language }, 32);
    const cached = await ctx.cache.get('tts', key, 'wav');
    if (cached) {
      const buf = decodeWav(await fsp.readFile(cached));
      ctx.usage({ provider: 'openai', kind: 'tts', model, units: req.text.length, unitType: 'characters', cached: true });
      return { samples: toMono(buf), sampleRate: buf.sampleRate, alignment: 'none', cached: true };
    }
    let bytes: Buffer;
    try {
      const res = await this.client().audio.speech.create(
        {
          model,
          voice: req.voiceId as never,
          input: req.text,
          response_format: 'wav',
          speed: req.speed,
          instructions: `Speak natural ${LANGUAGE_LABELS[req.language]} with a calm, confident storytelling tone, like a short educational finance video.`,
        },
        { signal: ctx.signal },
      );
      bytes = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      ctx.usage({ provider: 'openai', kind: 'tts', model, units: 0, unitType: 'characters', ok: false });
      const status = (err as { status?: number }).status;
      throw new ProviderError('openai', (err as Error).message, status, status === 429 || (status ?? 0) >= 500);
    }
    const buf = decodeWav(bytes);
    await ctx.cache.put('tts', key, 'wav', bytes, 'openai');
    ctx.usage({ provider: 'openai', kind: 'tts', model, units: req.text.length, unitType: 'characters' });
    return { samples: toMono(buf), sampleRate: buf.sampleRate, alignment: 'none', cached: false };
  }
}
