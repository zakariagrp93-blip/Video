import { STICK_ENGINE_NAMES, STICK_ENGINE_SOURCE } from './stickEngine.generated';

/**
 * Stick-figure explainers: Claude writes each video's shot list as JavaScript against a
 * small canvas engine (vendored from claude-animation-skills, MIT). The code only runs
 * inside the headless render browser — never in the app's main process — in a strict
 * function scope where browser globals are shadowed, after a deny-list check. This is
 * defence in depth, not a hard sandbox: the render page itself has no access to the
 * user's files and only holds the video plan.
 */

export interface StickShot {
  start: number;
  end: number;
  /** Transition out of this shot. */
  tr: 'whip' | 'cut';
  draw: (ctx: CanvasRenderingContext2D, lt: number, t: number) => void;
}

/** Words the generated code may not contain — it must stay pure drawing code. */
const FORBIDDEN =
  /\b(import|require|eval|Function|constructor|prototype|__proto__|__defineGetter__|globalThis|window|document|ownerDocument|defaultView|getRootNode|parentNode|parentElement|fetch|XMLHttpRequest|WebSocket|EventSource|Worker|SharedWorker|ServiceWorker|navigator|location|localStorage|sessionStorage|indexedDB|caches|postMessage|importScripts|setTimeout|setInterval|requestAnimationFrame|Reflect|Proxy|WebAssembly|process|Buffer|Image|OffscreenCanvas|createElement)\b/;

export function checkStickCode(code: string): string[] {
  const issues: string[] = [];
  if (code.length > 300_000) issues.push('The shot code is too long (max 300 000 characters).');
  if (!/SHOTS\.push\s*\(/.test(code)) issues.push('No shot found: the code must call SHOTS.push({ start, end, tr, draw(ctx, lt, t) { … } }).');
  const bad = code.match(new RegExp(FORBIDDEN.source, 'g'));
  if (bad) issues.push(`Forbidden identifiers (pure drawing code only): ${[...new Set(bad)].join(', ')}.`);
  if (/\[\s*['"`][^'"`]*['"`]\s*\+/.test(code)) issues.push('Computed property names built from strings are not allowed.');
  return issues;
}

/** Globals shadowed with `undefined` inside the compiled code, in addition to the FORBIDDEN check. */
const SHADOWED = ['window', 'document', 'globalThis', 'self', 'top', 'parent', 'frames', 'opener', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'navigator', 'location', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'importScripts', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'Function', 'Reflect', 'Proxy', 'WebAssembly', 'Image', 'OffscreenCanvas', 'process', 'require'];

let engineCache: Record<string, unknown> | null = null;

/** The engine's functions and constants, evaluated once. */
export function stickEngine(): Record<string, unknown> {
  // eslint-disable-next-line no-new-func
  engineCache ??= new Function(`"use strict";\n${STICK_ENGINE_SOURCE}\nreturn { ${STICK_ENGINE_NAMES.join(', ')} };`)() as Record<string, unknown>;
  return engineCache;
}

/**
 * Compile the shot code and return a clean, gap-free shot list covering [0, duration].
 * Throws with a readable message when the code is rejected or fails to load.
 */
export function compileStickShots(code: string, duration: number): StickShot[] {
  const issues = checkStickCode(code);
  if (issues.length) throw new Error(issues.join(' '));
  const engine = stickEngine();
  const raw: Array<Partial<StickShot>> = [];
  const names = [...STICK_ENGINE_NAMES, 'SHOTS', 'DURATION', ...SHADOWED];
  // eslint-disable-next-line no-new-func
  const run = new Function(...names, `"use strict";\n${code}\n`);
  run(...STICK_ENGINE_NAMES.map((n) => engine[n]), raw, duration, ...SHADOWED.map(() => undefined));
  return normalizeShots(raw, duration);
}

export function normalizeShots(raw: Array<Partial<StickShot>>, duration: number): StickShot[] {
  const shots = raw
    .filter((s): s is StickShot => typeof s?.draw === 'function' && Number.isFinite(s.start) && Number.isFinite(s.end))
    .map((s) => ({ start: Math.max(0, s.start), end: Math.min(duration, s.end), tr: s.tr === 'cut' ? 'cut' : 'whip', draw: s.draw }) as StickShot)
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
  if (!shots.length) throw new Error('The shot code defined no usable shot (each needs numeric start/end and a draw function).');
  // No holes: each shot runs until the next one starts; the first starts at 0, the last ends with the video.
  shots[0]!.start = 0;
  for (let i = 0; i < shots.length - 1; i++) shots[i]!.end = shots[i + 1]!.start;
  shots[shots.length - 1]!.end = duration;
  return shots.filter((s) => s.end - s.start > 1e-3);
}
