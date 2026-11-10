import type { FvsApi } from '../shared/ipc';

declare global {
  interface Window {
    fvs?: FvsApi;
  }
}

/** Typed access to the preload bridge. Outside Electron the app shows a clear error instead of fake data. */
export function api(): FvsApi {
  if (!window.fvs) throw new Error('Finance Video Studio must run inside its desktop shell (window.fvs is not available).');
  return window.fvs;
}

export function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Electron prefixes IPC errors with "Error invoking remote method '…': Error: "
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}
