import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AssetCache } from '../src/core/assets/assetCache';
import { AppDatabase } from '../src/core/db/database';
import type { ProviderContext } from '../src/core/providers/types';
import { createLogger } from '../src/core/util/logger';

export async function testContext(name = 'test'): Promise<{ ctx: ProviderContext; db: AppDatabase; dir: string; usage: unknown[] }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fvs-${name}-`));
  const db = await AppDatabase.open(null);
  const cache = new AssetCache(path.join(dir, 'cache'), db, () => true, () => 1e9);
  const usage: unknown[] = [];
  return { ctx: { cache, log: createLogger(name), usage: (r) => usage.push(r) }, db, dir, usage };
}

/** Shared voice cache so tests download each Piper voice only once. */
export const TEST_VOICES_DIR = process.env.FVS_TEST_VOICES_DIR ?? path.join(os.homedir(), '.cache', 'finance-video-studio-test', 'voices');
