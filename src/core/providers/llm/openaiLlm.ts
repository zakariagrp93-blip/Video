import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import { ProviderError } from '../../util/errors';
import { getFetchImplementation } from '../../util/http';
import type { ConnectionTestResult, ProviderContext } from '../types';
import { RemoteLLMProvider, type JsonRequest } from './remoteLlm';

/** OpenAI via the official SDK (Responses API with structured outputs). */
export class OpenAILLMProvider extends RemoteLLMProvider {
  readonly id = 'openai';
  readonly label = 'OpenAI';

  constructor(
    private readonly apiKey: () => string | undefined,
    getModel: () => string,
  ) {
    super(getModel);
  }

  private client(): OpenAI {
    const key = this.apiKey();
    if (!key) throw new ProviderError('openai', 'API key not configured');
    return new OpenAI({ apiKey: key, fetch: getFetchImplementation() as never, maxRetries: 2, timeout: 10 * 60 * 1000 });
  }

  checkReady(): string | null {
    return this.apiKey() ? null : 'OpenAI API key is not set (Settings → API keys).';
  }

  async testConnection(ctx: ProviderContext): Promise<ConnectionTestResult> {
    if (!this.apiKey()) return { ok: false, message: 'No API key configured.' };
    try {
      const m = await this.client().models.retrieve(this.model, { signal: ctx.signal });
      return { ok: true, message: `Connected. Model ${m.id} is available.` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  protected async completeJson<S extends z.ZodType>(req: JsonRequest<S>, ctx: ProviderContext): Promise<z.infer<S>> {
    try {
      const response = await this.client().responses.parse(
        {
          model: this.model,
          instructions: req.system,
          input: req.prompt,
          text: { format: zodTextFormat(req.schema as never, req.name) },
        },
        { signal: ctx.signal },
      );
      const usage = response.usage;
      ctx.usage({
        provider: 'openai',
        kind: 'llm',
        model: this.model,
        units: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
        unitType: 'tokens',
        inputTokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens,
      });
      if (!response.output_parsed) throw new ProviderError('openai', `Response for ${req.name} did not match the expected schema.`, undefined, true);
      return response.output_parsed as z.infer<S>;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const status = (err as { status?: number }).status;
      throw new ProviderError('openai', (err as Error).message, status, status === 429 || (status ?? 0) >= 500 || status === undefined);
    }
  }
}
