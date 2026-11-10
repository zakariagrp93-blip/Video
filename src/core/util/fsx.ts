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

/** Write a file atomically (temp file + rename) so a crash never leaves half-written JSON. */
export async function writeFileAtomic(file: string, data: string | Uint8Array): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, file);
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
