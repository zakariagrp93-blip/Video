import type { Language, NarratorOption } from '../../../shared/constants';
import { decodeWav, encodeWav } from '../../audio/wav';
import { ProviderError } from '../../util/errors';
import { hashOf } from '../../util/hash';
import { httpFetch } from '../../util/http';
import type { ConnectionTestResult, ProviderContext, SynthesisRequest, SynthesisResult, TTSProvider, VoiceInfo } from '../types';

const API = 'https://api.fish.audio';
const SAMPLE_RATE = 44100;

/** Voice from the user's example request ("Ethan"). Any voice ID from fish.audio can replace it. */
export const FISH_DEFAULT_VOICE = '536d3a5e000945adb7038665781a4aca';

const LANG_CODES: Record<Language, string> = { fr: 'fr', en: 'en', es: 'es', de: 'de' };

interface FishModel {
  _id: string;
  title?: string;
  languages?: string[];
  tags?: string[];
  visibility?: string;
  author?: { nickname?: string };
}

/**
 * Fish Audio text-to-speech (POST /v1/tts). The model is chosen with the `model` header
 * (e.g. "s2.1-pro-free", "s2-pro", "s1"), the voice with `reference_id`. Audio is
 * requested as raw 16-bit PCM so no decoder is needed. No word timestamps are returned:
 * subtitles use the silence-anchored aligner.
 */
export class FishAudioTTSProvider implements TTSProvider {
  readonly id = 'fishaudio';
  readonly label = 'Fish Audio';
  readonly isLocal = false;

  constructor(
    private readonly apiKey: () => string | undefined,
    private readonly model: () => string,
    private readonly voices: () => { male: string; female: string },
  ) {}

  checkReady(): string | null {
    if (!this.apiKey()) return 'Fish Audio API key is not set (Settings → API keys).';
    const v = this.voices();
    if (!v.male && !v.female) return 'Choose at least one Fish Audio voice ID in Settings → Voices.';
    return null;
  }

  private headers(json = true): Record<string, string> {
    const key = this.apiKey();
    if (!key) throw new ProviderError('fishaudio', 'API key not configured');
    return { authorization: `Bearer ${key}`, ...(json ? { 'content-type': 'application/json' } : {}) };
  }

  private explain(status: number, body: string): ProviderError {
    if (status === 401 || status === 403) return new ProviderError('fishaudio', 'Fish Audio rejected the API key (check it in Settings → API keys).', status, false);
    if (status === 402) return new ProviderError('fishaudio', 'Fish Audio: not enough credit for this model. Use the free model (s2.1-pro-free) or top up your Fish Audio account.', status, false);
    if (status === 404) return new ProviderError('fishaudio', 'Fish Audio: voice or model not found — check the voice ID and the model name in Settings.', status, false);
    return new ProviderError('fishaudio', `TTS failed (HTTP ${status}) ${body.slice(0, 200)}`, status, status === 429 || status >= 500);
  }

  async testConnection(ctx: ProviderContext): Promise<ConnectionTestResult> {
    if (!this.apiKey()) return { ok: false, message: 'No API key configured.' };
    const res = await httpFetch(`${API}/model?self=true&page_size=1`, { headers: this.headers(false), signal: ctx.signal });
    if (!res.ok) return { ok: false, message: this.explain(res.status, await res.text().catch(() => '')).message };
    return { ok: true, message: `Connected. Model ${this.model()} will be used.` };
  }

  /** The user's own voices, then popular library voices in the language. */
  async listVoices(language?: Language): Promise<VoiceInfo[]> {
    if (!this.apiKey()) return [];
    const lang = language ? LANG_CODES[language] : undefined;
    const get = async (query: string, category: string): Promise<VoiceInfo[]> => {
      const res = await httpFetch(`${API}/model?${query}`, { headers: this.headers(false) });
      if (!res.ok) {
        if (category === 'yours') throw this.explain(res.status, await res.text().catch(() => ''));
        return [];
      }
      const json = (await res.json()) as { items?: FishModel[] };
      return (json.items ?? []).map((m) => ({
        id: m._id,
        label: `${m.title ?? m._id}${m.author?.nickname ? ` (${m.author.nickname})` : ''}`,
        language: language ?? 'en',
        gender: m.tags?.some((t) => /^(male|man|homme)$/i.test(t)) ? 'male' : m.tags?.some((t) => /^(female|woman|femme)$/i.test(t)) ? 'female' : 'unspecified',
        category,
      }));
    };
    const mine = await get('self=true&page_size=50', 'yours');
    const library = await get(`page_size=40&sort_by=score${lang ? `&language=${lang}` : ''}`, 'library');
    const seen = new Set<string>();
    return [...mine, ...library].filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)));
  }

  async resolveVoice(language: Language, narrator: NarratorOption): Promise<VoiceInfo> {
    const v = this.voices();
    const id = narrator === 'male' ? v.male || v.female : narrator === 'female' ? v.female || v.male : v.male || v.female;
    if (!id) throw new ProviderError('fishaudio', 'No Fish Audio voice configured.');
    return { id, label: id === FISH_DEFAULT_VOICE ? 'Ethan (Fish Audio)' : `Fish Audio ${id.slice(0, 8)}`, language, gender: id === v.male ? 'male' : 'female' };
  }

  async synthesize(req: SynthesisRequest, ctx: ProviderContext): Promise<SynthesisResult> {
    const model = this.model();
    const key = hashOf({ p: 'fishaudio', v: 1, m: model, r: req.voiceId, t: req.text, s: req.speed }, 32);
    const cached = await ctx.cache.get('tts', key, 'wav');
    if (cached) {
      const buf = decodeWav(Buffer.from(await import('node:fs/promises').then((f) => f.readFile(cached))));
      ctx.usage({ provider: 'fishaudio', kind: 'tts', model, units: req.text.length, unitType: 'characters', cached: true });
      return { samples: buf.channels[0]!, sampleRate: buf.sampleRate, alignment: 'none', cached: true };
    }
    const res = await httpFetch(`${API}/v1/tts`, {
      method: 'POST',
      headers: { ...this.headers(), model },
      signal: ctx.signal,
      body: JSON.stringify({
        text: req.text,
        reference_id: req.voiceId,
        format: 'pcm',
        sample_rate: SAMPLE_RATE,
        normalize: true,
        latency: 'normal',
        prosody: { speed: Math.min(2, Math.max(0.5, req.speed)), volume: 0 },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      ctx.usage({ provider: 'fishaudio', kind: 'tts', model, units: 0, unitType: 'characters', ok: false });
      throw this.explain(res.status, body);
    }
    const pcm = Buffer.from(await res.arrayBuffer());
    if (pcm.length < 200) throw new ProviderError('fishaudio', 'Fish Audio returned no audio.', res.status, true);
    // Some deployments answer with a WAV container even for "pcm": skip a RIFF header if present.
    const data = pcm.subarray(0, 4).toString('latin1') === 'RIFF' ? decodeWav(pcm).channels[0]! : null;
    let samples: Float32Array;
    if (data) samples = data;
    else {
      samples = new Float32Array(Math.floor(pcm.length / 2));
      for (let i = 0; i < samples.length; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;
    }
    await ctx.cache.put('tts', key, 'wav', encodeWav({ sampleRate: SAMPLE_RATE, channels: [samples] }), 'fishaudio');
    ctx.usage({ provider: 'fishaudio', kind: 'tts', model, units: req.text.length, unitType: 'characters' });
    return { samples, sampleRate: SAMPLE_RATE, alignment: 'none', cached: false };
  }
}
