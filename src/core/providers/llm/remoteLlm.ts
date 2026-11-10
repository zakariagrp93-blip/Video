import type { z } from 'zod';
import type { GenerationOptions, Script, Storyboard } from '../../../shared/schemas';
import { hashOf } from '../../util/hash';
import type { ConnectionTestResult, LLMProvider, ProviderContext, SceneReview, ScriptRequest } from '../types';
import { LlmReviewSchema, LlmScriptSchema, LlmStoryboardSchema, scriptFromLlm, storyboardFromLlm } from './llmSchemas';
import { MOTIVATION_SCRIPT_SYSTEM, REVIEW_SYSTEM, SCRIPT_SYSTEM, STORYBOARD_SYSTEM, motivationUserPrompt, reviewUserPrompt, scriptUserPrompt, storyboardUserPrompt } from './prompts';
import { motivationStoryboard } from '../../motivation/motivation';
import { STICK_SCRIPT_SYSTEM, stickScriptPrompt, stickStoryboard } from '../../stick/stickDirector';

/** A long free-text completion (generated code), optionally with images to look at. */
export interface TextRequest {
  name: string;
  /** Large, stable instructions (cached by the provider when it can). */
  system: string;
  prompt: string;
  images?: Array<{ data: Buffer; mediaType: 'image/png' | 'image/jpeg' }>;
  /** Live progress while the answer streams: 'thinking', then the characters written so far. */
  onProgress?: (p: { phase: 'connecting' | 'thinking' | 'writing'; chars: number; quietSec?: number }) => void;
}

export interface JsonRequest<S extends z.ZodType> {
  name: string;
  system: string;
  prompt: string;
  schema: S;
}

/**
 * Shared logic for API-backed LLMs: prompting, response caching, conversion
 * to application schemas. Subclasses implement one structured-output call.
 */
export abstract class RemoteLLMProvider implements LLMProvider {
  abstract readonly id: string;
  abstract readonly label: string;
  readonly isLocal = false;

  constructor(protected readonly getModel: () => string) {}

  get model(): string {
    return this.getModel();
  }

  abstract checkReady(options?: GenerationOptions): string | null;
  abstract testConnection(ctx: ProviderContext): Promise<ConnectionTestResult>;
  protected abstract completeJson<S extends z.ZodType>(req: JsonRequest<S>, ctx: ProviderContext): Promise<z.infer<S>>;
  protected abstract completeText(req: TextRequest, ctx: ProviderContext): Promise<string>;

  /** Free-text completion with response caching (identical requests are free). */
  async writeText(req: TextRequest, ctx: ProviderContext, useCache = true): Promise<string> {
    const key = hashOf({ p: this.id, m: this.model, n: req.name, s: req.system, u: req.prompt, i: (req.images ?? []).map((im) => hashOf(im.data.toString('base64'), 16)) }, 32);
    if (useCache) {
      const hit = await ctx.cache.getText('llm', key);
      if (hit) {
        ctx.usage({ provider: this.id, kind: 'llm', model: this.model, units: 0, unitType: 'tokens', cached: true });
        return hit;
      }
    }
    const text = await this.completeText(req, ctx);
    await ctx.cache.put('llm', key, 'txt', text, this.id);
    return text;
  }

  /** Cache LLM responses by full prompt so retries/regenerations of the same input are free. */
  protected async cachedJson<S extends z.ZodType>(req: JsonRequest<S>, ctx: ProviderContext, useCache: boolean): Promise<z.infer<S>> {
    const key = hashOf({ p: this.id, m: this.model, n: req.name, s: req.system, u: req.prompt }, 32);
    if (useCache) {
      const hit = await ctx.cache.getText('llm', key);
      if (hit) {
        const parsed = req.schema.safeParse(JSON.parse(hit));
        if (parsed.success) {
          ctx.usage({ provider: this.id, kind: 'llm', model: this.model, units: 0, unitType: 'tokens', cached: true });
          return parsed.data;
        }
      }
    }
    const data = await this.completeJson(req, ctx);
    await ctx.cache.put('llm', key, 'json', JSON.stringify(data), this.id);
    return data;
  }

  async generateScript(req: ScriptRequest, ctx: ProviderContext, feedback?: string[]): Promise<Script> {
    const motivation = req.options.category === 'motivation';
    const stick = req.options.category === 'stickfigure';
    const raw = await this.cachedJson(
      {
        name: motivation ? 'motivation-script' : stick ? 'stick-script' : 'script',
        system: motivation ? MOTIVATION_SCRIPT_SYSTEM : stick ? STICK_SCRIPT_SYSTEM : SCRIPT_SYSTEM,
        prompt: motivation ? motivationUserPrompt(req, feedback) : stick ? stickScriptPrompt(req, feedback) : scriptUserPrompt(req, feedback),
        schema: LlmScriptSchema,
      },
      ctx,
      !feedback?.length,
    );
    return scriptFromLlm(raw, req, this.id, this.model);
  }

  async generateStoryboard(script: Script, req: ScriptRequest, ctx: ProviderContext, feedback?: string[]): Promise<Storyboard> {
    // Motivation edits are directed deterministically from the shot notes in the script.
    if (req.options.category === 'motivation') return motivationStoryboard(script);
    // Stick-figure explainers are directed by the shot code written in the animation stage.
    if (req.options.category === 'stickfigure') return stickStoryboard(script);
    const raw = await this.cachedJson({ name: 'storyboard', system: STORYBOARD_SYSTEM, prompt: storyboardUserPrompt(script, feedback), schema: LlmStoryboardSchema }, ctx, !feedback?.length);
    return storyboardFromLlm(raw, script);
  }

  async validateScenes(storyboard: Storyboard, ctx: ProviderContext): Promise<SceneReview> {
    const raw = await this.cachedJson({ name: 'review', system: REVIEW_SYSTEM, prompt: reviewUserPrompt(storyboard), schema: LlmReviewSchema }, ctx, true);
    return { ok: raw.ok || raw.issues.length === 0, issues: raw.issues };
  }
}
