import type { Language, NarratorOption } from '../../../shared/constants';
import type { WordTiming } from '../../../shared/schemas';
import { decodeWav, encodeWav } from '../../audio/wav';
import { ProviderError } from '../../util/errors';
import { hashOf } from '../../util/hash';
import { httpFetch } from '../../util/http';
import type { ConnectionTestResult, ProviderContext, SynthesisRequest, SynthesisResult, TTSProvider, VoiceInfo } from '../types';

const API = 'https://api.elevenlabs.io/v1';
const SAMPLE_RATE = 24000;

interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/** Group character-level alignment into word timings. */
export function wordsFromCharAlignment(al: Alignment): WordTiming[] {
  const words: WordTiming[] = [];
  let cur: WordTiming | null = null;
  for (let i = 0; i < al.characters.length; i++) {
    const ch = al.characters[i]!;
    const s = al.character_start_times_seconds[i] ?? 0;
    const e = al.character_end_times_seconds[i] ?? s;
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
      continue;
    }
    if (!cur) cur = { text: ch, start: s, end: e };
    else {
      cur.text += ch;
      cur.end = e;
    }
  }
  if (cur) words.push(cur);
  return words;
}

/** Models that accept the `language_code` request field. */
export function supportsLanguageCode(model: string): boolean {
  return /(turbo|flash)_v2_5/.test(model);
}

/** ElevenLabs TTS — uses the /with-timestamps endpoint for character-accurate subtitle timing. */
export class ElevenLabsTTSProvider implements TTSProvider {
  readonly id = 'elevenlabs';
  readonly label = 'ElevenLabs';
  readonly isLocal = false;

  constructor(
    private readonly apiKey: () => string | undefined,
    private readonly model: () => string,
    private readonly voices: () => { male: string; female: string },
  ) {}

  checkReady(): string | null {
    if (!this.apiKey()) return 'ElevenLabs API key is not set (Settings → API keys).';
    const v = this.voices();
    if (!v.male && !v.female) return 'Choose at least one ElevenLabs voice ID in Settings.';
    return null;
  }

  private headers(): Record<string, string> {
    const key = this.apiKey();
    if (!key) throw new ProviderError('elevenlabs', 'API key not configured');
    return { 'xi-api-key': key, 'content-type': 'application/json' };
  }

  async testConnection(ctx: ProviderContext): Promise<ConnectionTestResult> {
    if (!this.apiKey()) return { ok: false, message: 'No API key configured.' };
    const res = await httpFetch(`${API}/voices`, { headers: this.headers(), signal: ctx.signal });
    if (!res.ok) return { ok: false, message: `ElevenLabs returned HTTP ${res.status}.` };
    const json = (await res.json()) as { voices?: unknown[] };
    return { ok: true, message: `Connected. ${json.voices?.length ?? 0} voices available.` };
  }

  async listVoices(language?: Language): Promise<VoiceInfo[]> {
    if (!this.apiKey()) return [];
    const res = await httpFetch(`${API}/voices`, { headers: this.headers() });
    if (!res.ok) throw new ProviderError('elevenlabs', `Listing voices failed (HTTP ${res.status})`, res.status);
    const json = (await res.json()) as { voices: Array<{ voice_id: string; name: string; category?: string; labels?: Record<string, string> }> };
    return json.voices.map((v) => ({
      id: v.voice_id,
      label: v.name,
      language: language ?? 'en',
      gender: v.labels?.gender === 'male' ? 'male' : v.labels?.gender === 'female' ? 'female' : 'unspecified',
      category: v.category,
    }));
  }

  async resolveVoice(language: Language, narrator: NarratorOption): Promise<VoiceInfo> {
    const v = this.voices();
    const id = narrator === 'male' ? v.male || v.female : narrator === 'female' ? v.female || v.male : v.female || v.male;
    if (!id) throw new ProviderError('elevenlabs', 'No ElevenLabs voice configured.');
    return { id, label: id, language, gender: id === v.male ? 'male' : 'female' };
  }

  async synthesize(req: SynthesisRequest, ctx: ProviderContext): Promise<SynthesisResult> {
    const model = this.model();
    const key = hashOf({ p: 'elevenlabs', vs: 2, m: model, v: req.voiceId, t: req.text, s: req.speed, l: req.language }, 32);
    const cachedWav = await ctx.cache.get('tts', key, 'wav');
    const cachedMeta = await ctx.cache.getText('tts', `${key}m`);
    if (cachedWav && cachedMeta) {
      const buf = decodeWav(Buffer.from(await import('node:fs/promises').then((f) => f.readFile(cachedWav))));
      ctx.usage({ provider: 'elevenlabs', kind: 'tts', model, units: req.text.length, unitType: 'characters', cached: true });
      return { samples: buf.channels[0]!, sampleRate: buf.sampleRate, words: JSON.parse(cachedMeta) as WordTiming[], alignment: 'provider-chars', cached: true };
    }
    const res = await httpFetch(`${API}/text-to-speech/${encodeURIComponent(req.voiceId)}/with-timestamps?output_format=pcm_${SAMPLE_RATE}`, {
      method: 'POST',
      headers: this.headers(),
      signal: ctx.signal,
      body: JSON.stringify({
        text: req.text,
        model_id: model,
        // Only the Turbo/Flash v2.5 models accept an explicit language code.
        ...(supportsLanguageCode(model) ? { language_code: req.language } : {}),
        // Lower stability + some style = a livelier, less "read" delivery.
        voice_settings: { stability: 0.38, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true, speed: Math.min(1.2, Math.max(0.7, req.speed)) },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      ctx.usage({ provider: 'elevenlabs', kind: 'tts', model, units: 0, unitType: 'characters', ok: false });
      if (res.status === 402 || /paid_plan_required|payment_required/.test(body)) {
        throw new ProviderError(
          'elevenlabs',
          'This voice needs a paid ElevenLabs plan (free accounts can only use the default "premade" voices or voices you created). Settings → Voices → "Load my voices" and pick one marked free.',
          res.status,
          false,
        );
      }
      throw new ProviderError('elevenlabs', `TTS failed (HTTP ${res.status}) ${body.slice(0, 200)}`, res.status, res.status === 429 || res.status >= 500);
    }
    const json = (await res.json()) as { audio_base64: string; alignment?: Alignment; normalized_alignment?: Alignment };
    const pcm = Buffer.from(json.audio_base64, 'base64');
    const samples = new Float32Array(Math.floor(pcm.length / 2));
    for (let i = 0; i < samples.length; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;
    const words = json.alignment ? wordsFromCharAlignment(json.alignment) : undefined;
    await ctx.cache.put('tts', key, 'wav', encodeWav({ sampleRate: SAMPLE_RATE, channels: [samples] }), 'elevenlabs');
    if (words) await ctx.cache.put('tts', `${key}m`, 'json', JSON.stringify(words), 'elevenlabs');
    ctx.usage({ provider: 'elevenlabs', kind: 'tts', model, units: req.text.length, unitType: 'characters' });
    return { samples, sampleRate: SAMPLE_RATE, words, alignment: words ? 'provider-chars' : 'none', cached: false };
  }
}
