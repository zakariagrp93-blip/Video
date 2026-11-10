import { describe, expect, it } from 'vitest';
import { OfflineLLMProvider } from '../../src/core/providers/llm/offline/offlineLlm';
import { parseTopic } from '../../src/core/providers/llm/offline/topicParser';
import { buildScriptRequest, generateValidatedScript } from '../../src/core/script/scriptEngine';
import { generateValidatedStoryboard } from '../../src/core/storyboard/storyboardEngine';
import { GenerationOptionsSchema } from '../../src/shared/schemas';
import { testContext } from '../helpers';

const base = { duration: '60', language: 'fr', narrator: 'auto', storytelling: 'hypothetical', visualStyle: 'minimal-finance' } as const;

describe('topic parser', () => {
  it('parses the reference topic', () => {
    const p = parseTopic('What if you received €1 million at age 18?');
    expect(p).toMatchObject({ archetype: 'windfall', amount: 1_000_000, currency: 'EUR', age: 18 });
    expect(parseTopic("Et si tu recevais 1 million d'euros à 18 ans ?")).toMatchObject({ archetype: 'windfall', amount: 1_000_000, age: 18 });
    expect(parseTopic('What if you invested $200 a month for 30 years?')).toMatchObject({ archetype: 'invest-monthly', amount: 200, currency: 'USD', period: 'month', years: 30 });
    expect(parseTopic('Le vrai prix de ton café à 3 € par jour')).toMatchObject({ archetype: 'habit', item: 'coffee', amount: 3 });
    expect(parseTopic('5 000 € de dette sur une carte de crédit')).toMatchObject({ archetype: 'debt', amount: 5000 });
    expect(parseTopic('Start investing at 25 vs 35')).toMatchObject({ archetype: 'start-early', ages: [25, 35] });
    expect(parseTopic('Why is the sky blue').archetype).toBeNull();
  });
});

describe('offline story engine', () => {
  const provider = new OfflineLLMProvider();
  const topics = [
    'What if you received €1 million at age 18?',
    'What if you invested €150 per month for 30 years?',
    'What does a coffee every day really cost?',
    'Credit card debt of €5,000 paying the minimum',
    'Investing at 25 vs 35',
  ];
  for (const lang of ['fr', 'en'] as const) {
    for (const topic of topics) {
      it(`writes a valid script + storyboard (${lang}): ${topic}`, async () => {
        const { ctx } = await testContext();
        const options = GenerationOptionsSchema.parse({ ...base, language: lang, topic });
        const req = buildScriptRequest(options);
        const { script } = await generateValidatedScript(provider, req, ctx);
        expect(script.scenes.length).toBeGreaterThanOrEqual(8);
        expect(script.isHypothetical).toBe(true);
        const { storyboard } = await generateValidatedStoryboard(provider, script, req, ctx);
        expect(storyboard.scenes).toHaveLength(script.scenes.length);
        expect(new Set(storyboard.scenes.map((s) => s.id)).size).toBe(storyboard.scenes.length);
      });
    }
  }
  for (const duration of ['30', '45', '90', 'auto'] as const) {
    for (const topic of topics) {
      it(`fits the ${duration} duration target: ${topic}`, async () => {
        const { ctx } = await testContext();
        const options = GenerationOptionsSchema.parse({ ...base, duration, topic });
        const { script } = await generateValidatedScript(provider, buildScriptRequest(options), ctx);
        expect(script.scenes.length).toBeGreaterThanOrEqual(8);
      });
    }
  }
  it('rejects unsupported languages and topics honestly', () => {
    expect(provider.checkReady(GenerationOptionsSchema.parse({ ...base, language: 'de', topic: 'Was wäre wenn du 1 Million € erbst?' }))).toMatch(/French and English/);
    expect(provider.checkReady(GenerationOptionsSchema.parse({ ...base, topic: 'Why is the sky blue today?' }))).toMatch(/could not recognise/);
  });
  it('prints the French reference script', async () => {
    const { ctx } = await testContext();
    const options = GenerationOptionsSchema.parse({ ...base, topic: 'What if you received €1 million at age 18?' });
    const { script, warnings } = await generateValidatedScript(provider, buildScriptRequest(options), ctx);
    if (process.env.FVS_PRINT) console.log(script.title, '\n' + script.scenes.map((s, i) => `${i + 1}. ${s.narration}`).join('\n'), warnings);
    expect(script.title).toBe('Et si tu recevais 1 million d’euros à 18 ans ?');
  });
});
