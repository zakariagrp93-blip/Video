import type { PipelineStage } from '../../shared/constants';

/** An error with a message that is safe and useful to show to the user. */
export class UserFacingError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export class StageError extends Error {
  constructor(
    public readonly stage: PipelineStage,
    message: string,
    public readonly retryable: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StageError';
  }
}

export class CancelledError extends Error {
  constructor() {
    super('Generation cancelled by the user.');
    this.name = 'CancelledError';
  }
}

/** The model hit its output limit: retrying the same request would fail the same way. */
export class TruncatedResponseError extends Error {
  constructor(
    public readonly provider: string,
    public readonly request: string,
    public readonly outputTokens: number,
  ) {
    super(`${provider}: the answer for ${request} was too long and was cut off (${outputTokens} output tokens).`);
    this.name = 'TruncatedResponseError';
  }
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(`${provider}: ${message}`);
    this.name = 'ProviderError';
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CancelledError();
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof CancelledError) return false;
  if (err instanceof ProviderError || err instanceof UserFacingError || err instanceof StageError) return err.retryable;
  const e = err as { code?: string; status?: number };
  if (e?.status === 429 || (typeof e?.status === 'number' && e.status >= 500)) return true;
  return ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'UND_ERR_SOCKET'].includes(e?.code ?? '');
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
