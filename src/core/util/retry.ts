import { CancelledError, isRetryable, throwIfAborted } from './errors';

export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  shouldRetry?: (err: unknown) => boolean;
  onRetry?: (err: unknown, attempt: number) => void;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new CancelledError());
      },
      { once: true },
    );
  });
}

/** Retry with exponential backoff, bounded by `retries`. Never retries cancellations. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  const { retries, baseDelayMs = 1000, signal, shouldRetry = isRetryable, onRetry } = opts;
  let attempt = 0;
  for (;;) {
    throwIfAborted(signal);
    try {
      return await fn(attempt);
    } catch (err) {
      if (err instanceof CancelledError || attempt >= retries || !shouldRetry(err)) throw err;
      attempt += 1;
      onRetry?.(err, attempt);
      await sleep(baseDelayMs * 2 ** (attempt - 1), signal);
    }
  }
}
