import { describe, expect, it } from 'vitest';
import { PiperTTSProvider } from '../../src/core/providers/tts/piper/piperTts';
import { alignUtterance, detectSilences } from '../../src/core/subtitles/align';
import { displayTokens, normalizeForSpeech } from '../../src/core/text/speech';
import { TEST_VOICES_DIR, testContext } from '../helpers';

describe('Piper TTS (local neural voice)', () => {
  const tts = new PiperTTSProvider(TEST_VOICES_DIR, () => ({}));

  it('resolves voices per language and gender', async () => {
    expect((await tts.resolveVoice('fr', 'female')).id).toBe('fr-siwis-medium');
    expect((await tts.resolveVoice('fr', 'male')).id).toBe('fr-gilles-low');
    expect((await tts.resolveVoice('de', 'female')).id).toBe('de-ramona-low');
  });

  it('synthesizes French speech with a realistic duration and caches it', async () => {
    const { ctx, usage } = await testContext('tts');
    const voice = await tts.resolveVoice('fr', 'female');
    await tts.prepareVoice(voice, ctx);
    const sentence = 'Soit environ 3 750 € par mois, rien qu’avec les intérêts.';
    const text = normalizeForSpeech(sentence, 'fr');
    const t0 = Date.now();
    const res = await tts.synthesize({ text, language: 'fr', voiceId: voice.id, speed: 1 }, ctx);
    const seconds = res.samples.length / res.sampleRate;
    expect(res.sampleRate).toBe(22050);
    expect(seconds).toBeGreaterThan(2);
    expect(seconds).toBeLessThan(7);
    let peak = 0;
    for (const v of res.samples) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeGreaterThan(0.5);
    const again = await tts.synthesize({ text, language: 'fr', voiceId: voice.id, speed: 1 }, ctx);
    expect(again.cached).toBe(true);
    expect(again.samples.length).toBe(res.samples.length);
    expect(usage.length).toBe(2);
    // Slower speech must be longer. Piper durations are stochastic (±6 % run to run),
    // so compare averages of fresh, uncached syntheses at clearly different speeds.
    const avgLen = async (speed: number) => {
      let total = 0;
      for (let i = 0; i < 3; i++) {
        const fresh = (await testContext('tts-speed')).ctx;
        total += (await tts.synthesize({ text, language: 'fr', voiceId: voice.id, speed }, fresh)).samples.length;
      }
      return total / 3;
    };
    expect(await avgLen(0.7)).toBeGreaterThan((await avgLen(1)) * 1.15);

    // Alignment on real audio: monotonic, inside the audio, pause detected at the comma.
    const { silences } = detectSilences(res.samples, res.sampleRate);
    expect(silences.length).toBeGreaterThanOrEqual(1);
    const aligned = alignUtterance(displayTokens(sentence), res.samples, res.sampleRate, 'fr');
    expect(aligned.words.map((w) => w.text)).toEqual(displayTokens(sentence));
    for (let i = 1; i < aligned.words.length; i++) expect(aligned.words[i]!.start).toBeGreaterThanOrEqual(aligned.words[i - 1]!.start);
    expect(aligned.words.at(-1)!.end).toBeLessThanOrEqual(seconds + 0.01);
    expect(aligned.method).toBe('silence-anchored');
    console.log(`synth ${seconds.toFixed(2)}s audio in ${Date.now() - t0}ms; silences`, silences.map((s) => `${s.start.toFixed(2)}-${s.end.toFixed(2)}`).join(' '));
  });
});
