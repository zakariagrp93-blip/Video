import type { z } from 'zod';
import type { GenerationOptions, Script, Storyboard } from '../../../shared/schemas';
import { hashOf } from '../../util/hash';
import type { ConnectionTestResult, LLMProvider, ProviderContext, SceneReview, ScriptRequest } from '../types';
import { LlmReviewSchema, LlmScriptSchema, LlmStoryboardSchema, scriptFromLlm, storyboardFromLlm } from './llmSchemas';
import { REVIEW_SYSTEM, SCRIPT_SYSTEM, STORYBOARD_SYSTEM, reviewUserPrompt, scriptUserPrompt, storyboardUserPrompt } from './prompts';

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
    const raw = await this.cachedJson({ name: 'script', system: SCRIPT_SYSTEM, prompt: scriptUserPrompt(req, feedback), schema: LlmScriptSchema }, ctx, !feedback?.length);
    return scriptFromLlm(raw, req, this.id, this.model);
  }

  async generateStoryboard(script: Script, _req: ScriptRequest, ctx: ProviderContext, feedback?: string[]): Promise<Storyboard> {
    void _req;
    const raw = await this.cachedJson({ name: 'storyboard', system: STORYBOARD_SYSTEM, prompt: storyboardUserPrompt(script, feedback), schema: LlmStoryboardSchema }, ctx, !feedback?.length);
    return storyboardFromLlm(raw, script);
  }

  async validateScenes(storyboard: Storyboard, ctx: ProviderContext): Promise<SceneReview> {
    const raw = await this.cachedJson({ name: 'review', system: REVIEW_SYSTEM, prompt: reviewUserPrompt(storyboard), schema: LlmReviewSchema }, ctx, true);
    return { ok: raw.ok || raw.issues.length === 0, issues: raw.issues };
  }
}
