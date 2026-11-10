import { StoryboardSchema, type Script, type Storyboard } from '../../shared/schemas';
import type { LLMProvider, ProviderContext, ScriptRequest } from '../providers/types';
import { UserFacingError } from '../util/errors';
import { directScene } from './director';
import { repairStoryboard, reviewStoryboardRules } from './rules';

export interface StoryboardValidation {
  errors: string[];
  warnings: string[];
}

export function validateStoryboard(sb: Storyboard, script: Script): StoryboardValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = StoryboardSchema.safeParse(sb);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`), warnings };
  if (sb.scenes.length !== script.scenes.length) errors.push(`Storyboard has ${sb.scenes.length} scenes but the script has ${script.scenes.length}.`);
  sb.scenes.forEach((s, i) => {
    const expected = script.scenes[i]?.narration;
    if (expected && s.narration.trim() !== expected.trim()) errors.push(`Scene ${i + 1} narration differs from the script; narration must be copied verbatim.`);
  });
  warnings.push(...reviewStoryboardRules(sb));
  return { errors, warnings };
}

export interface StoryboardResult {
  storyboard: Storyboard;
  warnings: string[];
  attempts: number;
}

/**
 * Generate the storyboard, enforce continuity with deterministic repairs,
 * then validate (schema + rules + provider scene review). Invalid scenes from a
 * remote LLM are regenerated with feedback; as a last resort individual scenes
 * fall back to the rule-based director so a single bad scene never blocks a video.
 */
export async function generateValidatedStoryboard(provider: LLMProvider, script: Script, req: ScriptRequest, ctx: ProviderContext, maxAttempts = 3): Promise<StoryboardResult> {
  let feedback: string[] | undefined;
  let last: StoryboardValidation = { errors: [], warnings: [] };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let sb: Storyboard;
    try {
      sb = await provider.generateStoryboard(script, req, ctx, feedback);
    } catch (err) {
      if (attempt === maxAttempts || provider.isLocal) throw err;
      feedback = [(err as Error).message];
      continue;
    }
    // Narration must match the script exactly — restore it rather than fail.
    sb.scenes = sb.scenes.map((s, i) => ({ ...s, narration: script.scenes[i]?.narration ?? s.narration, emphasis: s.emphasis.length ? s.emphasis : (script.scenes[i]?.emphasis ?? []), negative: s.negative.length ? s.negative : (script.scenes[i]?.negative ?? []) }));
    if (sb.scenes.length !== script.scenes.length) {
      last = { errors: [`Expected ${script.scenes.length} scenes, got ${sb.scenes.length}.`], warnings: [] };
      feedback = last.errors;
      if (provider.isLocal) break;
      continue;
    }
    sb = repairStoryboard(sb);
    last = validateStoryboard(sb, script);
    if (last.errors.length === 0) {
      const review = await provider.validateScenes(sb, ctx);
      if (review.ok || attempt === maxAttempts || provider.isLocal) {
        return { storyboard: sb, warnings: [...last.warnings, ...review.issues], attempts: attempt };
      }
      feedback = review.issues;
      continue;
    }
    feedback = last.errors;
    if (provider.isLocal) break;
  }
  // Final fallback: rule-based direction for every scene (keeps the script, guarantees a valid storyboard).
  if (!provider.isLocal) {
    ctx.log.warn('Falling back to rule-based storyboard after validation failures:', last.errors);
    const sb = repairStoryboard({
      version: 1,
      title: script.title,
      language: script.language,
      characterId: 'nummo',
      scenes: script.scenes.map((s, i) => directScene(s, i, script.scenes.length, script.language)),
      illustrations: [],
    });
    const v = validateStoryboard(sb, script);
    if (v.errors.length === 0) return { storyboard: sb, warnings: ['Storyboard built by the rule-based director after LLM validation failures.', ...v.warnings], attempts: maxAttempts };
  }
  throw new UserFacingError(`The storyboard did not pass validation: ${last.errors.join(' ')}`, !provider.isLocal);
}
