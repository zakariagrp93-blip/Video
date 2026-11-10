import { describe, expect, it } from 'vitest';
import { MOTIFS, MOTIVATION_THEMES } from '../../src/shared/constants';
import { GenerationOptionsSchema, ScriptSchema, StoryboardSchema } from '../../src/shared/schemas';
import { LINES } from '../../src/core/motivation/lines';
import { detectTheme, motivationStoryboard, parseLine, parseVisualNote, topicAsHook, writeMotivation } from '../../src/core/motivation/motivation';
import { OfflineLLMProvider } from '../../src/core/providers/llm/offline/offlineLlm';
import { buildScriptRequest, validateScript } from '../../src/core/script/scriptEngine';
import { beatGrid, generateEditMusic, snapToGrid } from '../../src/core/audio/editMusic';
import { testContext } from '../helpers';

const opts = (topic: string, duration: '30' | '45' | '60' | '90', language: 'fr' | 'en' = 'fr') =>
  GenerationOptionsSchema.parse({ topic, duration, language, narrator: 'auto', storytelling: 'storytelling', visualStyle: 'minimal-finance', category: 'motivation' });

describe('motivation writer', () => {
  it('every line in the bank parses (known motif and prop)', () => {
    for (const lang of ['fr', 'en'] as const)
      for (const theme of MOTIVATION_THEMES)
        for (const [section, lines] of Object.entries(LINES[lang][theme]))
          for (const l of lines) {
            const b = parseLine(l, section as never);
            expect(MOTIFS).toContain(b.motif);
            expect(b.text).not.toMatch(/[*~]/);
          }
  });

  it('detects the theme from the topic', () => {
    expect(detectTheme('motivation argent, devenir riche')).toBe('money');
    expect(detectTheme('Discipline : se lever à 5h')).toBe('discipline');
    expect(detectTheme('Never give up on your dream of success')).toBe('success');
    expect(detectTheme('Gérer la peur et le doute')).toBe('mindset');
    expect(detectTheme('xyz')).toBe('money');
  });

  it('uses a statement topic as the hook, but not an instruction or a label', () => {
    expect(topicAsHook('Personne ne viendra te sauver')).toBe('Personne ne viendra te sauver.');
    expect(topicAsHook('fais une vidéo motivation argent')).toBeNull();
    expect(topicAsHook('motivation argent')).toBeNull();
    expect(topicAsHook('discipline 5h du matin')).toBeNull();
    expect(topicAsHook('Motivation argent : personne ne viendra te rendre riche')).toBe('Personne ne viendra te rendre riche.');
    expect(topicAsHook("Money: nobody is coming to save you")).toBe('Nobody is coming to save you.');
  });

  it.each(['30', '45', '60', '90'] as const)('offline script for %s s passes validation in French and English', async (d) => {
    for (const lang of ['fr', 'en'] as const) {
      for (const topic of ['motivation argent tiktok', 'discipline et travail', 'réussite et succès', 'mental et confiance']) {
        const req = buildScriptRequest(opts(topic, d, lang));
        const { ctx } = await testContext();
        const script = await new OfflineLLMProvider().generateScript(req, ctx);
        expect(ScriptSchema.parse(script).scenes.length).toBeGreaterThanOrEqual(8);
        const v = validateScript(script, req, { lenientShort: true });
        expect(v.errors, `${lang} ${d}s ${topic}`).toEqual([]);
        expect(script.isHypothetical).toBe(false);
        const sb = StoryboardSchema.parse(motivationStoryboard(script));
        expect(sb.scenes.every((s) => s.motif)).toBe(true);
        expect(sb.scenes[1]!.effect).toBe('impact');
        // Consecutive shots differ (except two hero objects in a row).
        for (let i = 1; i < sb.scenes.length; i++) if (sb.scenes[i]!.motif !== 'spotlight') expect(sb.scenes[i]!.motif).not.toBe(sb.scenes[i - 1]!.motif);
        // A shot is used at most twice; the hook's opening word is never reused.
        const uses = new Map<string, number>();
        for (const sc of sb.scenes) if (sc.motif !== 'spotlight') uses.set(sc.motif!, (uses.get(sc.motif!) ?? 0) + 1);
        expect(Math.max(0, ...uses.values())).toBeLessThanOrEqual(2);
        const first = (t: string) => t.split(/\s+/)[0]!.toLowerCase();
        expect(script.scenes.slice(1).filter((x) => first(x.narration) === first(script.scenes[0]!.narration))).toEqual([]);
      }
    }
  });

  it('is deterministic for a topic', () => {
    const a = writeMotivation({ topic: 'argent', language: 'fr', wordRange: [90, 130] });
    const b = writeMotivation({ topic: 'argent', language: 'fr', wordRange: [90, 130] });
    expect(a.beats.map((x) => x.text)).toEqual(b.beats.map((x) => x.text));
  });

  it('directs LLM scripts from shot notes, falling back to keywords', () => {
    expect(parseVisualNote('motif:spotlight hero:sports-car hit')).toEqual({ motif: 'spotlight', hero: 'sports-car', hit: true });
    expect(parseVisualNote('a car on a road')).toBeNull();
  });

  it('offline engine refuses Spanish/German motivation edits with a clear message', () => {
    const o = GenerationOptionsSchema.parse({ topic: 'motivación dinero', duration: '60', language: 'es', narrator: 'auto', storytelling: 'storytelling', visualStyle: 'minimal-finance', category: 'motivation' });
    expect(new OfflineLLMProvider().checkReady(o)).toMatch(/French and English/);
  });
});

describe('edit soundtrack', () => {
  it('puts a bar line on the drop and snaps cuts to half beats', () => {
    const g = beatGrid('phonk', 42, 3.37);
    const bar = (60 / g.bpm) * 4;
    expect(((g.dropAt - g.offset) / bar) % 1).toBeCloseTo(0, 6);
    const half = 60 / g.bpm / 2;
    const t = g.offset + 10 * half + 0.05;
    expect(snapToGrid(t, g)).toBeCloseTo(g.offset + 10 * half, 6);
    // Never moves a cut more than 60 ms after the voice cue.
    expect(snapToGrid(g.offset + 10 * half - 0.1, g)).toBeCloseTo(g.offset + 10 * half - 0.1, 6);
  });

  it.each(['phonk', 'epic', 'piano'] as const)('%s renders a normalised stereo track with a louder drop', (style) => {
    const grid = beatGrid(style, 7, 2.5);
    const buf = generateEditMusic({ durationSec: 12, seed: 7, style, grid });
    expect(buf.channels).toHaveLength(2);
    const L = buf.channels[0]!;
    let peak = 0;
    for (const v of L) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeLessThanOrEqual(0.81);
    expect(peak).toBeGreaterThan(0.5);
    const rms = (a: number, b: number) => {
      let s = 0;
      for (let i = Math.floor(a * buf.sampleRate); i < Math.floor(b * buf.sampleRate); i++) s += L[i]! * L[i]!;
      return Math.sqrt(s / ((b - a) * buf.sampleRate));
    };
    expect(rms(3, 8)).toBeGreaterThan(rms(0.3, 2.2));
  });
});
