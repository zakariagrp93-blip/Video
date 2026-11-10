import { z } from 'zod';
import {
  BACKGROUNDS,
  CAMERA_MOVES,
  CHARACTER_MOTIONS,
  CHARACTER_POSITIONS,
  CHART_KINDS,
  CHART_TRENDS,
  EFFECTS,
  EXPRESSIONS,
  POSES,
  PROP_ANIMATIONS,
  PROP_ASSETS,
  PROP_PLACEMENTS,
  SFX_TIMINGS,
  SFX_TYPES,
  TEXT_STYLES,
  TRANSITIONS,
} from '../../../shared/constants';
import type { Script, ScriptRequest, Storyboard, StoryboardScene } from './llmTypes';

/**
 * Schemas sent to LLMs for structured output. They avoid features that
 * structured-output JSON schema subsets reject (defaults, numeric bounds,
 * optional keys): every field is required, "empty" means unused. The result is
 * then converted and validated against the strict application schemas.
 */
export const LlmScriptSchema = z.object({
  title: z.string(),
  hook: z.string(),
  isHypothetical: z.boolean(),
  assumptions: z.array(z.string()),
  claims: z.array(z.object({ text: z.string(), kind: z.enum(['hypothesis', 'calculation', 'fact']), source: z.string() })),
  scenes: z.array(
    z.object({
      narration: z.string(),
      visual: z.string(),
      characterAction: z.string(),
      camera: z.string(),
      animation: z.string(),
      sfx: z.string(),
      durationHint: z.number(),
      emphasis: z.array(z.string()),
      negative: z.array(z.string()),
    }),
  ),
  finalLine: z.string(),
  hashtags: z.array(z.string()),
});
export type LlmScript = z.infer<typeof LlmScriptSchema>;

export const LlmStoryboardSchema = z.object({
  scenes: z.array(
    z.object({
      character: z.object({
        visible: z.boolean(),
        pose: z.enum(POSES),
        expression: z.enum(EXPRESSIONS),
        position: z.enum(CHARACTER_POSITIONS),
        motion: z.enum(CHARACTER_MOTIONS),
        facing: z.enum(['left', 'right']),
      }),
      background: z.enum(BACKGROUNDS),
      props: z.array(
        z.object({
          asset: z.enum(PROP_ASSETS),
          animation: z.enum(PROP_ANIMATIONS),
          placement: z.enum(PROP_PLACEMENTS),
          count: z.number(),
          label: z.string(),
          delay: z.number(),
          imageKey: z.string(),
        }),
      ),
      effect: z.enum(EFFECTS),
      camera: z.enum(CAMERA_MOVES),
      transition: z.enum(TRANSITIONS),
      overlay: z.object({
        enabled: z.boolean(),
        text: z.string(),
        style: z.enum(TEXT_STYLES),
        counterEnabled: z.boolean(),
        counterFrom: z.number(),
        counterTo: z.number(),
        prefix: z.string(),
        suffix: z.string(),
      }),
      chart: z.object({ enabled: z.boolean(), kind: z.enum(CHART_KINDS), trend: z.enum(CHART_TRENDS), values: z.array(z.number()), label: z.string() }),
      sfx: z.array(z.object({ type: z.enum(SFX_TYPES), at: z.enum(SFX_TIMINGS) })),
    }),
  ),
  illustrations: z.array(z.object({ key: z.string(), prompt: z.string() })),
});
export type LlmStoryboard = z.infer<typeof LlmStoryboardSchema>;

export const LlmReviewSchema = z.object({ ok: z.boolean(), issues: z.array(z.string()) });

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function scriptFromLlm(raw: LlmScript, req: ScriptRequest, provider: string, model: string): Script {
  return {
    version: 1,
    title: raw.title.slice(0, 120),
    hook: raw.hook,
    language: req.options.language,
    storytelling: req.options.storytelling,
    isHypothetical: raw.isHypothetical,
    assumptions: raw.assumptions,
    claims: raw.claims.map((c) => ({ text: c.text, kind: c.kind, source: c.source || undefined })),
    scenes: raw.scenes.map((s) => ({ ...s, durationHint: clamp(s.durationHint || 4, 1, 15) })),
    finalLine: raw.finalLine,
    fullNarration: raw.scenes.map((s) => s.narration).join(' '),
    hashtags: raw.hashtags,
    generator: { provider, model },
  };
}

export function storyboardFromLlm(raw: LlmStoryboard, script: Script): Storyboard {
  const scenes: StoryboardScene[] = raw.scenes.map((s, i) => {
    const src = script.scenes[i];
    return {
      id: `s${String(i + 1).padStart(2, '0')}`,
      narration: src?.narration ?? '',
      emphasis: src?.emphasis ?? [],
      negative: src?.negative ?? [],
      durationHint: src?.durationHint ?? 4,
      visualDescription: src?.visual ?? '',
      character: s.character,
      background: s.background,
      props: s.props.slice(0, 5).map((p) => ({
        asset: p.asset,
        animation: p.animation,
        placement: p.placement,
        count: clamp(Math.round(p.count || 1), 1, 12),
        label: p.label ? p.label.slice(0, 24) : undefined,
        delay: clamp(p.delay || 0, 0, 0.9),
        imageKey: p.imageKey && /^[a-z0-9-]{2,40}$/.test(p.imageKey) ? p.imageKey : undefined,
      })),
      effect: s.effect,
      camera: s.camera,
      transition: s.transition,
      textOverlay: s.overlay.enabled
        ? {
            text: s.overlay.text.slice(0, 60),
            style: s.overlay.style,
            counter: s.overlay.counterEnabled ? { from: s.overlay.counterFrom, to: s.overlay.counterTo, prefix: s.overlay.prefix.slice(0, 6), suffix: s.overlay.suffix.slice(0, 12), decimals: 0 } : undefined,
          }
        : null,
      chart: s.chart.enabled && s.chart.values.length >= 3 ? { kind: s.chart.kind, trend: s.chart.trend, values: s.chart.values.slice(0, 16), label: s.chart.label ? s.chart.label.slice(0, 30) : undefined } : null,
      sfx: s.sfx.slice(0, 3),
    };
  });
  return {
    version: 1,
    title: script.title,
    language: script.language,
    characterId: 'nummo',
    scenes,
    illustrations: raw.illustrations.filter((il) => /^[a-z0-9-]{2,40}$/.test(il.key) && il.prompt.length >= 5).slice(0, 8),
  };
}
