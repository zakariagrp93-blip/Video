import { WORDS_PER_SECOND, type DurationOption, type Language } from '../../shared/constants';
import { ScriptSchema, type GenerationOptions, type Script } from '../../shared/schemas';
import type { LLMProvider, ProviderContext, ScriptRequest } from '../providers/types';
import { wordCount } from '../text/speech';
import { UserFacingError } from '../util/errors';

export function resolveTargetSeconds(duration: DurationOption, storytelling: GenerationOptions['storytelling']): number {
  if (duration !== 'auto') return Number(duration);
  return storytelling === 'facts' ? 45 : 60;
}

export function buildScriptRequest(options: GenerationOptions, speed = 1): ScriptRequest {
  const targetSeconds = resolveTargetSeconds(options.duration, options.storytelling);
  // Leave ~12% of the duration for pauses between sentences and scenes.
  const wps = WORDS_PER_SECOND[options.language] * speed;
  const ideal = targetSeconds * 0.88 * wps;
  return { options, targetSeconds, wordRange: [Math.round(ideal * 0.8), Math.round(ideal * 1.15)] };
}

const GENERIC_PHRASES: Record<Language, RegExp[]> = {
  fr: [/dans cette vidéo/i, /plongeons/i, /sans plus attendre/i, /n'oublie(z)? pas de (t'|vous )?abonner/i, /aujourd'hui,? (on|nous) va(s|) parler/i, /bienvenue/i],
  en: [/in this video/i, /let'?s dive in/i, /without further ado/i, /don'?t forget to (like|subscribe)/i, /today we('| a)re going to talk/i, /welcome back/i, /delve/i],
  es: [/en este v[ií]deo/i, /sin m[aá]s pre[aá]mbulos/i, /no olvides suscribirte/i, /bienvenidos/i],
  de: [/in diesem video/i, /lass(t)? uns eintauchen/i, /vergiss nicht zu abonnieren/i, /willkommen zur[üu]ck/i],
};

const LANG_MARKERS: Record<Language, RegExp> = {
  fr: /\b(le|la|les|et|tu|un|une|des|est|pas|pour|avec|que)\b/gi,
  en: /\b(the|and|you|a|is|not|for|with|that|your)\b/gi,
  es: /\b(el|la|los|las|y|tú|un|una|es|no|para|con|que)\b/gi,
  de: /\b(der|die|das|und|du|ein|eine|ist|nicht|für|mit|dass)\b/gi,
};

export interface ScriptValidation {
  errors: string[];
  warnings: string[];
  words: number;
}

/** Content checks beyond the JSON schema. Errors trigger a regeneration with feedback. */
export function validateScript(script: Script, req: ScriptRequest, opts: { lenientShort?: boolean } = {}): ScriptValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = ScriptSchema.safeParse(script);
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`), warnings, words: 0 };
  }
  const lang = req.options.language;
  const words = script.scenes.reduce((n, s) => n + wordCount(s.narration), 0);
  const [min, max] = req.wordRange;
  if (words < min * 0.7) {
    if (opts.lenientShort) warnings.push(`The offline story engine wrote ${words} words (about ${Math.round(words / 2.6)} s of narration), shorter than the ${req.targetSeconds} s target. Configure an LLM provider in Settings for longer videos.`);
    else errors.push(`Narration is too short (${words} words, target ${min}–${max}).`);
  }
  else if (words > max * 1.3) errors.push(`Narration is too long (${words} words, target ${min}–${max}).`);
  else if (words < min || words > max) warnings.push(`Narration length ${words} words is outside the ideal ${min}–${max} range.`);
  if (script.language !== lang) errors.push(`Script language is ${script.language}, expected ${lang}.`);
  const joined = script.scenes.map((s) => s.narration).join(' ');
  const markers = Object.entries(LANG_MARKERS).map(([l, re]) => [l, joined.match(re)?.length ?? 0] as const);
  const best = markers.sort((a, b) => b[1] - a[1])[0]!;
  if (best[0] !== lang && best[1] > 5) errors.push(`Narration does not appear to be written in ${lang}.`);
  for (const re of GENERIC_PHRASES[lang]) if (re.test(joined)) errors.push(`Avoid generic filler phrasing (matched "${re.source}").`);
  const firstWords = script.scenes.map((s) => s.narration.split(/\s+/)[0]?.toLowerCase().replace(/[^\p{L}]/gu, '') ?? '');
  const counts = new Map<string, number>();
  for (const w of firstWords) if (w) counts.set(w, (counts.get(w) ?? 0) + 1);
  for (const [w, n] of counts) if (n >= 4) errors.push(`Too many scenes start with "${w}" — vary the sentence openings.`);
  const hookNorm = script.hook.replace(/\W/g, '').toLowerCase().slice(0, 25);
  if (!script.scenes[0]!.narration.replace(/\W/g, '').toLowerCase().includes(hookNorm.slice(0, 15))) {
    errors.push('The first scene must open with the hook.');
  }
  for (const c of script.claims) {
    if (c.kind === 'fact' && !c.source) errors.push(`Factual claim without a verifiable source: "${c.text}". Remove it or present it as a hypothesis.`);
  }
  for (const s of script.scenes) {
    if (wordCount(s.narration) > 40) warnings.push(`A scene has ${wordCount(s.narration)} words; shorter scenes read better.`);
  }
  if (script.isHypothetical && script.assumptions.length === 0) warnings.push('Hypothetical script without stated assumptions.');
  return { errors, warnings, words };
}

export interface ScriptResult {
  script: Script;
  warnings: string[];
  attempts: number;
}

/** Generate → validate → regenerate with the validation feedback (bounded). */
export async function generateValidatedScript(provider: LLMProvider, req: ScriptRequest, ctx: ProviderContext, maxAttempts = 3): Promise<ScriptResult> {
  let feedback: string[] | undefined;
  let lastErrors: string[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const script = await provider.generateScript(req, ctx, feedback);
    const v = validateScript(script, req, { lenientShort: provider.isLocal });
    if (v.errors.length === 0) return { script, warnings: v.warnings, attempts: attempt };
    ctx.log.warn(`Script validation failed (attempt ${attempt}):`, v.errors);
    lastErrors = v.errors;
    feedback = v.errors;
    if (provider.isLocal) break; // deterministic engine: retrying cannot change the result
  }
  throw new UserFacingError(`The script did not pass validation: ${lastErrors.join(' ')}`, !provider.isLocal);
}
