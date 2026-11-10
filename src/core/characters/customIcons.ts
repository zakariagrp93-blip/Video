import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { PROP_ASSETS, type PropAsset } from '../../shared/constants';
import type { Storyboard } from '../../shared/schemas';
import { ensureDir, safeJoin } from '../util/fsx';
import { sha256 } from '../util/hash';

export const CUSTOM_ICON_EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg'] as const;
const MAX_BYTES = 8 * 1024 * 1024;

/** Image key used by the renderer for a user icon that replaces a built-in asset. */
export function customIconKey(asset: PropAsset): string {
  return `asset:${asset}`;
}

/** List which assets the user's icon folder overrides (file name = asset name, any supported extension). */
export function scanCustomIcons(dir: string): Partial<Record<PropAsset, string>> {
  const found: Partial<Record<PropAsset, string>> = {};
  if (!dir || !fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!(CUSTOM_ICON_EXTENSIONS as readonly string[]).includes(ext)) continue;
    const base = path.basename(entry.name, path.extname(entry.name)).toLowerCase();
    if ((PROP_ASSETS as readonly string[]).includes(base)) found[base as PropAsset] = path.join(dir, entry.name);
  }
  return found;
}

/**
 * Copy the user's icons used by this storyboard into the project (content-hashed
 * names, so a replaced icon invalidates the cached scene renders).
 */
export async function importCustomIcons(dir: string, sb: Storyboard, illustrationsDir: string): Promise<{ images: Record<string, string>; warnings: string[] }> {
  const images: Record<string, string> = {};
  const warnings: string[] = [];
  if (!dir) return { images, warnings };
  if (!fs.existsSync(dir)) return { images, warnings: [`Custom icons folder not found: ${dir}`] };
  const available = scanCustomIcons(dir);
  const used = new Set<PropAsset>();
  for (const s of sb.scenes) for (const p of s.props) used.add(p.asset);
  await ensureDir(illustrationsDir);
  for (const asset of used) {
    const src = available[asset];
    if (!src) continue;
    const stat = await fsp.stat(src);
    if (stat.size > MAX_BYTES) {
      warnings.push(`Custom icon ${path.basename(src)} is larger than 8 MB and was skipped.`);
      continue;
    }
    const data = await fsp.readFile(src);
    if (path.extname(src).toLowerCase() === '.svg' && /<script|on\w+\s*=|javascript:/i.test(data.toString('utf8'))) {
      warnings.push(`Custom icon ${path.basename(src)} contains scripts and was skipped.`);
      continue;
    }
    const name = `custom-${asset}-${sha256(data).slice(0, 10)}${path.extname(src).toLowerCase()}`;
    await fsp.writeFile(safeJoin(illustrationsDir, name), data);
    images[customIconKey(asset)] = name;
  }
  return { images, warnings };
}
