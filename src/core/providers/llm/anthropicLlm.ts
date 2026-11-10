import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { ProviderError } from '../../util/errors';
import { getFetchImplementation } from '../../util/http';
import type { ConnectionTestResult, ProviderContext } from '../types';
import { RemoteLLMProvider, type JsonRequest, type TextRequest } from './remoteLlm';

/**
 * Claude via the official Anthropic SDK, using structured outputs so every
 * response is schema-valid JSON. Server-side refusal fallbacks are enabled.
 */
export class AnthropicLLMProvider extends RemoteLLMProvider {
  readonly id = 'anthropic';
  readonly label = 'Anthropic Claude';

  constructor(
    private readonly apiKey: () => string | undefined,
    getModel: () => string,
  ) {
    super(getModel);
  }

  private client(): Anthropic {
    const key = this.apiKey();
    if (!key) throw new ProviderError('anthropic', 'API key not configured');
    return new Anthropic({ apiKey: key, fetch: getFetchImplementation() as never, maxRetries: 2, timeout: 10 * 60 * 1000 });
  }

  checkReady(): string | null {
    return this.apiKey() ? null : 'Anthropic API key is not set (Settings → API keys).';
  }

  async testConnection(ctx: ProviderContext): Promise<ConnectionTestResult> {
    if (!this.apiKey()) return { ok: false, message: 'No API key configured.' };
    try {
      const m = await this.client().models.retrieve(this.model, {}, { signal: ctx.signal });
      return { ok: true, message: `Connected. Model ${m.id} is available.` };
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) return { ok: false, message: 'Invalid API key.' };
      if (err instanceof Anthropic.NotFoundError) return { ok: false, message: `Model ${this.model} not found for this key.` };
      if (err instanceof Anthropic.APIError) return { ok: false, message: `API error ${err.status}: ${err.message}` };
      return { ok: false, message: (err as Error).message };
    }
  }

  /** Long outputs (generated shot code) are streamed so the request never hits an HTTP timeout. */
  protected async completeText(req: TextRequest, ctx: ProviderContext): Promise<string> {
    try {
      const content: Anthropic.Beta.BetaContentBlockParam[] = [
        ...(req.images ?? []).map((im) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: im.mediaType, data: im.data.toString('base64') } })),
        { type: 'text' as const, text: req.prompt },
      ];
      const response = await this.client()
        .beta.messages.stream(
          {
            model: this.model,
            max_tokens: 64000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            // The engine reference is large and identical for every video: cache it.
            system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content }],
            output_config: { effort: 'high' },
          },
          { signal: ctx.signal },
        )
        .finalMessage();
      ctx.usage({
        provider: 'anthropic',
        kind: 'llm',
        model: response.model,
        units: response.usage.input_tokens + response.usage.output_tokens,
        unitType: 'tokens',
        // Cached reads cost ~0.1x, cache writes ~1.25x: fold them into billable input tokens.
        inputTokens: Math.round(response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) * 0.1 + (response.usage.cache_creation_input_tokens ?? 0) * 1.25),
        outputTokens: response.usage.output_tokens,
      });
      if (response.stop_reason === 'refusal') throw new ProviderError('anthropic', 'The model declined this request. Try rephrasing the topic.', undefined, false);
      if (response.stop_reason === 'max_tokens') throw new ProviderError('anthropic', `Response for ${req.name} was truncated (max_tokens).`, undefined, true);
      return response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    } catch (err) {
      throw this.mapError(err);
    }
  }

  private mapError(err: unknown): unknown {
    if (err instanceof ProviderError) return err;
    if (err instanceof Anthropic.AuthenticationError) return new ProviderError('anthropic', 'Invalid API key.', 401, false);
    if (err instanceof Anthropic.RateLimitError) return new ProviderError('anthropic', 'Rate limited.', 429, true);
    if (err instanceof Anthropic.BadRequestError) return new ProviderError('anthropic', `Bad request: ${err.message}`, 400, false);
    if (err instanceof Anthropic.APIError) return new ProviderError('anthropic', err.message, err.status, (err.status ?? 0) >= 500);
    if (err instanceof Anthropic.APIConnectionError) return new ProviderError('anthropic', 'Network error contacting the API.', undefined, true);
    return err;
  }

  protected async completeJson<S extends z.ZodType>(req: JsonRequest<S>, ctx: ProviderContext): Promise<z.infer<S>> {
    try {
      const response = await this.client().beta.messages.parse(
        {
          model: this.model,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: req.system,
          messages: [{ role: 'user', content: req.prompt }],
          output_config: { effort: 'medium', format: betaZodOutputFormat(req.schema) },
        },
        { signal: ctx.signal },
      );
      ctx.usage({
        provider: 'anthropic',
        kind: 'llm',
        model: response.model,
        units: response.usage.input_tokens + response.usage.output_tokens,
        unitType: 'tokens',
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });
      if (response.stop_reason === 'refusal') throw new ProviderError('anthropic', 'The model declined this request. Try rephrasing the topic.', undefined, false);
      if (response.stop_reason === 'max_tokens') throw new ProviderError('anthropic', 'Response was truncated (max_tokens).', undefined, true);
      if (!response.parsed_output) throw new ProviderError('anthropic', `Response for ${req.name} did not match the expected schema.`, undefined, true);
      return response.parsed_output as z.infer<S>;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof Anthropic.AuthenticationError) throw new ProviderError('anthropic', 'Invalid API key.', 401, false);
      if (err instanceof Anthropic.RateLimitError) throw new ProviderError('anthropic', 'Rate limited.', 429, true);
      if (err instanceof Anthropic.BadRequestError) throw new ProviderError('anthropic', `Bad request: ${err.message}`, 400, false);
      if (err instanceof Anthropic.APIError) throw new ProviderError('anthropic', err.message, err.status, (err.status ?? 0) >= 500);
      if (err instanceof Anthropic.APIConnectionError) throw new ProviderError('anthropic', 'Network error contacting the API.', undefined, true);
      throw err;
    }
  }
}
