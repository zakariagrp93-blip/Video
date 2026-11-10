import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export async function ensureDir(dir: string): Promise<string> {
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Join path segments under `root`, refusing anything that would escape it
 * (absolute segments, `..` traversal, drive letters). All project paths go through this.
 */
export function safeJoin(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  for (const seg of segments) {
    if (path.isAbsolute(seg) || /^[a-zA-Z]:/.test(seg)) throw new Error(`Unsafe path segment: ${seg}`);
  }
  const target = path.resolve(resolvedRoot, ...segments);
  const rel = path.relative(resolvedRoot, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Path escapes root: ${segments.join('/')}`);
  return target;
}

const TRANSIENT_FS = new Set(['EPERM', 'EACCES', 'EBUSY']);

/**
 * rename() that survives Windows' transient locks: replacing a file another handle is
 * reading, or one antivirus / the search indexer is scanning, fails with EPERM/EACCES/EBUSY
 * for a few milliseconds. Retry with backoff (≈ 6 s at most), as graceful-fs does.
 */
export async function renameWithRetry(from: string, to: string, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<void> {
  let delay = 10;
  for (let attempt = 0; ; attempt++) {
    try {
      await fsp.rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? '';
      if (!TRANSIENT_FS.has(code) || attempt >= 14) throw err;
      await sleep(delay);
      delay = Math.min(1000, delay * 2);
    }
  }
}

/** Writes to the same file are queued so two saves never race on the rename. */
const writeQueues = new Map<string, Promise<void>>();

/** Write a file atomically (temp file + rename) so a crash never leaves half-written JSON. */
export async function writeFileAtomic(file: string, data: string | Uint8Array): Promise<void> {
  const key = path.resolve(file);
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(async () => {
    await ensureDir(path.dirname(file));
    const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    await fsp.writeFile(tmp, data);
    try {
      await renameWithRetry(tmp, file);
    } catch (err) {
      await fsp.rm(tmp, { force: true }).catch(() => undefined);
      throw err;
    }
  });
  writeQueues.set(key, run);
  try {
    await run;
  } finally {
    if (writeQueues.get(key) === run) writeQueues.delete(key);
  }
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFileAtomic(file, JSON.stringify(value, null, 2));
}

export async function readJson<T = unknown>(file: string): Promise<T> {
  return JSON.parse(await fsp.readFile(file, 'utf8')) as T;
}

export async function readJsonIfExists<T = unknown>(file: string): Promise<T | undefined> {
  if (!(await exists(file))) return undefined;
  return readJson<T>(file);
}

export async function dirSize(dir: string): Promise<number> {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSize(p);
    else if (e.isFile()) total += (await fsp.stat(p)).size;
  }
  return total;
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await fsp.cp(src, dest, { recursive: true, errorOnExist: false, force: true });
}

export function sanitizeFileName(name: string, max = 60): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return (cleaned || 'video').slice(0, max);
}
