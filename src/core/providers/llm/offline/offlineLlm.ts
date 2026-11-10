import { WORDS_PER_SECOND } from '../../../../shared/constants';
import { ScriptSchema, StoryboardSchema, type GenerationOptions, type Script, type Storyboard, type StoryboardScene } from '../../../../shared/schemas';
import { directScene } from '../../../storyboard/director';
import { reviewStoryboardRules } from '../../../storyboard/rules';
import { wordCount } from '../../../text/speech';
import { UserFacingError } from '../../../util/errors';
import type { ConnectionTestResult, LLMProvider, ProviderContext, SceneReview, ScriptRequest } from '../../types';
import { writeArchetype, type ArchetypeOutput, type OfflineLanguage } from './archetypes';
import { describeAction, describeVisual, type Beat } from './direction';
import { parseTopic } from './topicParser';
import { isMotivationLanguage, motivationStoryboard, visualNote, writeMotivation } from '../../../motivation/motivation';

export const OFFLINE_SUPPORTED = [
  'windfall — "What if you received €1 million at 18?"',
  'monthly investing — "What if you invested €200 a month for 30 years?"',
  'habit cost — "What does a €3 coffee every day really cost?"',
  'debt — "€5,000 on a credit card paying only the minimum"',
  'starting early — "Investing at 25 vs 35"',
];

/** Lower score = dropped first when a script must be shortened. */
function beatScore(b: Beat, i: number, n: number): number {
  if (i === 0 || i === n - 1) return 1000;
  let s = 0;
  if (b.dir.overlay?.counter) s += 3;
  if (b.dir.chart) s += 1;
  if (b.negative.length) s += 1;
  if (/hypoth|assum/i.test(b.text)) s += 4; // assumptions must stay — they make the numbers honest
  return s;
}

/**
 * Deterministic offline story engine. It writes real calculations into a
 * fixed set of narrative archetypes (French and English). It does not invent
 * facts: every figure is computed from stated hypotheses.
 */
export class OfflineLLMProvider implements LLMProvider {
  readonly id = 'offline';
  readonly label = 'Offline story engine (no API)';
  readonly model = 'fvs-offline-1';
  readonly isLocal = true;

  checkReady(options?: GenerationOptions): string | null {
    if (!options) return null;
    if (options.category === 'stickfigure') {
      return 'Stick-figure explainers are written and animated by Claude: add an Anthropic API key (Settings → API keys) and choose Anthropic Claude as the script provider (Settings → AI providers).';
    }
    if (options.category === 'motivation') {
      return isMotivationLanguage(options.language) ? null : 'The offline engine writes motivation edits in French and English only. Configure an LLM provider (Settings → AI providers) for Spanish or German.';
    }
    if (options.language !== 'fr' && options.language !== 'en') {
      return 'The offline story engine writes French and English only. Configure an LLM provider (Settings → AI providers) for Spanish or German.';
    }
    if (!parseTopic(options.topic).archetype) {
      return `The offline story engine could not recognise this topic. It handles: ${OFFLINE_SUPPORTED.join('; ')}. For free-form topics, configure an LLM provider in Settings.`;
    }
    return null;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, message: 'Offline engine is built in and always available.' };
  }

  private compose(req: ScriptRequest): { out: ArchetypeOutput; beats: Beat[] } {
    const ready = this.checkReady(req.options);
    if (ready) throw new UserFacingError(ready);
    const parsed = parseTopic(req.options.topic);
    const out = writeArchetype(parsed, req.options.language as OfflineLanguage, req.options.storytelling);
    let beats = out.beats.map((b) => ({ ...b }));
    const total = () => beats.reduce((a, b) => a + wordCount(b.text), 0);
    const max = req.wordRange[1];
    // Condense the longest beats first (keeps the story arc), then drop low-value beats.
    const condensable = () => beats.map((b, i) => ({ b, i, gain: b.short ? wordCount(b.text) - wordCount(b.short) : 0 })).filter((x) => x.gain > 0).sort((a, b) => b.gain - a.gain);
    while (total() > max) {
      const next = condensable()[0];
      if (!next) break;
      next.b.text = next.b.short!;
      next.b.short = undefined;
    }
    while (total() > max && beats.length > 8) {
      let worst = 1;
      let worstScore = Infinity;
      for (let i = 1; i < beats.length - 1; i++) {
        const sc = beatScore(beats[i]!, i, beats.length);
        if (sc <= worstScore) {
          worstScore = sc;
          worst = i;
        }
      }
      beats = beats.filter((_, i) => i !== worst);
    }
    return { out, beats };
  }

  private motivationScript(req: ScriptRequest): Script {
    const ready = this.checkReady(req.options);
    if (ready) throw new UserFacingError(ready);
    const m = writeMotivation({ topic: req.options.topic, language: req.options.language as 'fr' | 'en', wordRange: req.wordRange });
    const wps = WORDS_PER_SECOND[req.options.language];
    return ScriptSchema.parse({
      version: 1,
      title: m.title,
      hook: m.beats[0]!.text,
      language: req.options.language,
      storytelling: req.options.storytelling,
      isHypothetical: false,
      assumptions: [],
      claims: [],
      scenes: m.beats.map((b) => ({
        narration: b.text,
        visual: visualNote(b),
        characterAction: b.motif === 'spotlight' ? 'none (hero object)' : 'silhouette',
        camera: 'cinematic',
        animation: 'kinetic typography',
        sfx: b.hit ? 'impact@start' : 'whoosh',
        durationHint: Math.min(15, Math.max(1.5, Math.round((wordCount(b.text) / wps + 0.8) * 10) / 10)),
        emphasis: b.emphasis,
        negative: b.negative,
      })),
      finalLine: m.beats[m.beats.length - 1]!.text,
      fullNarration: m.beats.map((b) => b.text).join(' '),
      hashtags: m.hashtags,
      generator: { provider: this.id, model: this.model },
    });
  }

  async generateScript(req: ScriptRequest, ctx: ProviderContext): Promise<Script> {
    if (req.options.category === 'motivation') {
      ctx.usage({ provider: 'offline', kind: 'llm', model: this.model, units: 0, unitType: 'tokens' });
      return this.motivationScript(req);
    }
    const { out, beats } = this.compose(req);
    const wps = WORDS_PER_SECOND[req.options.language];
    const script: Script = {
      version: 1,
      title: out.title,
      hook: beats[0]!.text,
      language: req.options.language,
      storytelling: req.options.storytelling,
      isHypothetical: true,
      assumptions: out.assumptions,
      claims: out.claims,
      scenes: beats.map((b) => ({
        narration: b.text,
        visual: describeVisual(b.dir),
        characterAction: describeAction(b.dir),
        camera: b.dir.cam,
        animation: b.dir.props.length ? b.dir.props.map((p) => `${p.asset}: ${p.animation}`).join(', ') : b.dir.chart ? `${b.dir.chart.kind} chart ${b.dir.chart.trend}` : 'character motion',
        sfx: b.dir.sfx.map((s) => `${s.type}@${s.at}`).join(', ') || 'none',
        durationHint: Math.min(15, Math.max(1.5, Math.round((wordCount(b.text) / wps) * 10) / 10)),
        emphasis: b.emphasis,
        negative: b.negative,
      })),
      finalLine: beats[beats.length - 1]!.text,
      fullNarration: beats.map((b) => b.text).join(' '),
      hashtags: out.hashtags,
      generator: { provider: this.id, model: this.model },
    };
    ctx.usage({ provider: 'offline', kind: 'llm', model: this.model, units: 0, unitType: 'tokens' });
    return ScriptSchema.parse(script);
  }

  async generateStoryboard(script: Script, req: ScriptRequest, ctx: ProviderContext): Promise<Storyboard> {
    if (req.options.category === 'motivation') return StoryboardSchema.parse(motivationStoryboard(script));
    let beats: Beat[] = [];
    try {
      beats = this.compose(req).beats;
    } catch {
      beats = [];
    }
    const scenes: StoryboardScene[] = script.scenes.map((s, i) => {
      const b = beats.find((x) => x.text === s.narration);
      if (!b) return directScene(s, i, script.scenes.length, script.language);
      return {
        id: `s${String(i + 1).padStart(2, '0')}`,
        narration: s.narration,
        emphasis: s.emphasis,
        negative: s.negative,
        durationHint: s.durationHint,
        visualDescription: s.visual,
        character: { visible: b.dir.visible, pose: b.dir.pose, expression: b.dir.expr, position: b.dir.pos, motion: b.dir.motion, facing: b.dir.facing },
        background: b.dir.bg,
        props: b.dir.props,
        effect: b.dir.fx,
        camera: b.dir.cam,
        transition: i === 0 ? 'cut' : b.dir.tr,
        textOverlay: b.dir.overlay,
        chart: b.dir.chart,
        sfx: b.dir.sfx,
      };
    });
    ctx.usage({ provider: 'offline', kind: 'llm', model: this.model, units: 0, unitType: 'tokens' });
    return StoryboardSchema.parse({ version: 1, title: script.title, language: script.language, characterId: 'nummo', scenes, illustrations: [] });
  }

  async validateScenes(storyboard: Storyboard): Promise<SceneReview> {
    const issues = reviewStoryboardRules(storyboard);
    return { ok: issues.length === 0, issues };
  }
}
