/**
 * Single fetch entry point. Electron injects `net.fetch` (honours the system
 * proxy and certificates); Node uses the global fetch.
 */
type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

let impl: FetchFn = (input, init) => fetch(input, init);

export function setFetchImplementation(fn: FetchFn): void {
  impl = fn;
}

export function httpFetch(input: string, init?: RequestInit): Promise<Response> {
  return impl(input, init);
}

export function getFetchImplementation(): FetchFn {
  return impl;
}

/** Download a URL into memory with progress reporting and abort support. */
export async function downloadToBuffer(
  url: string,
  opts: { signal?: AbortSignal; onProgress?: (fraction: number) => void; maxBytes?: number } = {},
): Promise<Buffer> {
  const res = await httpFetch(url, { signal: opts.signal, redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status} ${res.statusText}) for ${url}`);
  const total = Number(res.headers.get('content-length') ?? 0);
  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (opts.maxBytes && received > opts.maxBytes) throw new Error('Download exceeds the allowed size.');
    if (total && opts.onProgress) opts.onProgress(Math.min(1, received / total));
  }
  return Buffer.concat(chunks);
}
