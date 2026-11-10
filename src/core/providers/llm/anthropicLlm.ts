import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { ProviderError, TruncatedResponseError } from '../../util/errors';
import { getFetchImplementation } from '../../util/http';
import type { ConnectionTestResult, ProviderContext } from '../types';
import { RemoteLLMProvider, type JsonRequest, type TextRequest } from './remoteLlm';

/**
 * Claude via the official Anthropic SDK, using structured outputs so every
 * response is schema-valid JSON. Server-side refusal fallbacks are enabled.
 */
/** Abort a streamed answer when nothing at all has arrived for this long. */
export const STREAM_STALL_MS = Number(process.env.FVS_STREAM_STALL_MS) || 6 * 60 * 1000;

export class AnthropicLLMProvider extends RemoteLLMProvider {
  readonly id = 'anthropic';
  readonly label = 'Anthropic Claude';

  constructor(
    private readonly apiKey: () => string | undefined,
    getModel: () => string,
  ) {
    super(getModel);
  }

  /** onBytes: called for every chunk of the raw response body (including the API's keep-alive pings). */
  private client(onBytes?: () => void): Anthropic {
    const key = this.apiKey();
    if (!key) throw new ProviderError('anthropic', 'API key not configured');
    const base = getFetchImplementation();
    const fetchImpl = onBytes
      ? async (input: Parameters<typeof base>[0], init?: Parameters<typeof base>[1]) => {
          const res = await base(input, init);
          if (!res.body) return res;
          const reader = res.body.getReader();
          const body = new ReadableStream<Uint8Array>({
            async pull(controller) {
              const { done, value } = await reader.read();
              if (done) controller.close();
              else {
                onBytes();
                controller.enqueue(value);
              }
            },
            cancel(reason) {
              return reader.cancel(reason);
            },
          });
          return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
        }
      : base;
    return new Anthropic({ apiKey: key, fetch: fetchImpl as never, maxRetries: 2, timeout: 10 * 60 * 1000 });
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
      req.onProgress?.({ phase: 'connecting', chars: 0 });
      let lastEvent = Date.now();
      const stream = this.client(() => {
        lastEvent = Date.now();
      }).beta.messages.stream(
          {
            model: this.model,
            max_tokens: 48000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            // The engine reference is large and identical for every video: cache it.
            system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content }],
            // 'medium' (the model's default) writes a full shot list in a few minutes; 'high' took far longer.
            output_config: { effort: 'medium' },
          },
          // A full shot list can take 10+ minutes to write: don't let the client time out mid-answer.
          { signal: ctx.signal, timeout: 40 * 60 * 1000 },
        );
      let chars = 0;
      let last = 0;
      let phase: 'thinking' | 'writing' | null = null;
      let lastLog = Date.now();
      const started = Date.now();
      ctx.log.info(`Claude ${req.name}: request sent (${Math.round((req.system.length + req.prompt.length) / 1000)}k chars of prompt${req.images?.length ? `, ${req.images.length} image(s)` : ''})`);
      const tick = (p: 'thinking' | 'writing', force = false) => {
        phase = p;
        const now = Date.now();
        if (force || now - last > 800) {
          last = now;
          req.onProgress?.({ phase: p, chars, quietSec: Math.round((now - lastEvent) / 1000) });
        }
        if (now - lastLog > 60_000) {
          lastLog = now;
          ctx.log.info(`Claude ${req.name}: ${phase}, ${chars} chars after ${Math.round((now - started) / 1000)} s`);
        }
      };
      stream.on('streamEvent', (ev) => {
        if (!phase) tick('thinking', true); // the request reached Claude
        if (ev.type === 'content_block_start' && ev.content_block.type === 'thinking') tick('thinking');
        if (ev.type === 'content_block_delta' && ev.delta.type !== 'text_delta') tick('thinking');
      });
      stream.on('text', (delta) => {
        chars += delta.length;
        tick('writing');
      });
      // Watchdog: a reply that stops arriving (stalled connection, antivirus or proxy holding the
      // stream) would otherwise wait forever. Any bytes from the API — keep-alive pings included —
      // reset the clock, so a long silent "thinking" phase is not mistaken for a stall.
      let stalled = false;
      const watchdog = setInterval(() => {
        if (Date.now() - lastEvent > STREAM_STALL_MS) {
          stalled = true;
          stream.abort();
          return;
        }
        // Keep the clock moving on screen (and in the log) even while Claude thinks silently.
        if (phase) tick(phase, true);
      }, 2000);
      let response: Awaited<ReturnType<typeof stream.finalMessage>>;
      try {
        response = await stream.finalMessage();
      } catch (err) {
        if (stalled) throw new ProviderError('anthropic', `No data from Claude for ${STREAM_STALL_MS >= 60000 ? `${Math.round(STREAM_STALL_MS / 60000)} minutes` : `${Math.round(STREAM_STALL_MS / 1000)} s`} (connection stalled). Retrying.`, undefined, true);
        throw err;
      } finally {
        clearInterval(watchdog);
      }
      ctx.log.info(`Claude ${req.name}: done in ${Math.round((Date.now() - started) / 1000)} s, ${response.usage.output_tokens} output tokens, stop ${response.stop_reason}`);
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
      // Not retryable as-is: the same request would be cut off again. The caller asks for a shorter answer.
      if (response.stop_reason === 'max_tokens') throw new TruncatedResponseError('anthropic', req.name, response.usage.output_tokens);
      return response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    } catch (err) {
      throw this.mapError(err);
    }
  }

  private mapError(err: unknown): unknown {
    if (err instanceof ProviderError || err instanceof TruncatedResponseError) return err;
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
