import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AppDatabase } from '../db/database';
import { ensureDir, exists, safeJoin } from '../util/fsx';

/**
 * Content-addressed cache for expensive generated assets (AI images, TTS audio,
 * LLM responses, music beds). Keys are hashes of every input that influences
 * the output, so identical requests are never paid for twice.
 */
export class AssetCache {
  constructor(
    private readonly dir: string,
    private readonly db: AppDatabase,
    private readonly enabled: () => boolean,
    private readonly maxBytes: () => number,
  ) {}

  private fileFor(kind: string, key: string, ext: string): string {
    if (!/^[a-z0-9-]+$/i.test(kind) || !/^[a-z0-9]+$/i.test(key) || !/^[a-z0-9]+$/i.test(ext)) {
      throw new Error('Invalid cache key');
    }
    return safeJoin(this.dir, kind, `${key}.${ext}`);
  }

  async get(kind: string, key: string, ext: string): Promise<string | undefined> {
    if (!this.enabled()) return undefined;
    const file = this.fileFor(kind, key, ext);
    if (!(await exists(file))) return undefined;
    this.db.run('UPDATE asset_cache SET hits = hits + 1, last_used_at = ? WHERE key = ?', [new Date().toISOString(), `${kind}/${key}`]);
    return file;
  }

  async getText(kind: string, key: string): Promise<string | undefined> {
    const file = await this.get(kind, key, 'json');
    return file ? fsp.readFile(file, 'utf8') : undefined;
  }

  async put(kind: string, key: string, ext: string, data: Uint8Array | string, provider: string): Promise<string> {
    const file = this.fileFor(kind, key, ext);
    if (!this.enabled()) return file;
    await ensureDir(path.dirname(file));
    await fsp.writeFile(file, data);
    const bytes = typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength;
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO asset_cache (key, kind, path, provider, bytes, hits, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(key) DO UPDATE SET path=excluded.path, bytes=excluded.bytes, last_used_at=excluded.last_used_at`,
      [`${kind}/${key}`, kind, file, provider, bytes, now, now],
    );
    await this.evictIfNeeded();
    return file;
  }

  /** Least-recently-used eviction down to the configured size. */
  async evictIfNeeded(): Promise<void> {
    const total = this.db.get<{ s: number | null }>('SELECT SUM(bytes) AS s FROM asset_cache')?.s ?? 0;
    let excess = total - this.maxBytes();
    if (excess <= 0) return;
    const rows = this.db.all<{ key: string; path: string; bytes: number }>('SELECT key, path, bytes FROM asset_cache ORDER BY last_used_at ASC');
    for (const r of rows) {
      if (excess <= 0) break;
      await fsp.rm(r.path, { force: true });
      this.db.run('DELETE FROM asset_cache WHERE key = ?', [r.key]);
      excess -= r.bytes;
    }
  }

  stats(): { entries: number; bytes: number; hits: number } {
    const r = this.db.get<{ n: number; b: number | null; h: number | null }>('SELECT COUNT(*) AS n, SUM(bytes) AS b, SUM(hits) AS h FROM asset_cache');
    return { entries: r?.n ?? 0, bytes: r?.b ?? 0, hits: r?.h ?? 0 };
  }

  async clear(): Promise<void> {
    await fsp.rm(this.dir, { recursive: true, force: true });
    this.db.run('DELETE FROM asset_cache');
  }
}
