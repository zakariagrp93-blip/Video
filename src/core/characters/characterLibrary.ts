import fsp from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_THEME, EXPRESSIONS, POSES, PROP_ASSETS, type Expression, type Pose, type PropAsset } from '../../shared/constants';
import type { Storyboard } from '../../shared/schemas';
import { Mascot } from '../../remotion/Mascot';
import { ICONS } from '../../remotion/props/icons';
import { ensureDir, exists, readJsonIfExists, safeJoin, writeFileAtomic, writeJson } from '../util/fsx';

/** Bump when the mascot drawing changes so libraries are regenerated. */
export const CHARACTER_VERSION = 'nummo-1';

export interface CharacterManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  viewBox: { width: number; height: number };
  poses: readonly Pose[];
  expressions: readonly Expression[];
  palette: { body: string; outline: string; sprout: string; accent: string };
  files: Record<string, string>;
}

function mascotSvg(pose: Pose, expression: Expression): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${renderToStaticMarkup(
    React.createElement(Mascot, { pose, expression, frame: 12, fps: 30, accent: DEFAULT_THEME.accent, sprout: DEFAULT_THEME.positive }),
  ).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')}`;
}

export function propSvg(asset: PropAsset, accent = DEFAULT_THEME.accent): string {
  const Icon = ICONS[asset];
  const inner = renderToStaticMarkup(React.createElement(Icon, { accent }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400">${inner}</svg>`;
}

/**
 * The reusable character library (app-level). Every pose × expression of the
 * mascot exists once as an SVG; projects reference these rather than generating
 * a new character per scene, which guarantees identical appearance everywhere.
 */
export class CharacterLibrary {
  constructor(private readonly dir: string) {}

  get root(): string {
    return safeJoin(this.dir, 'nummo');
  }

  async ensure(): Promise<CharacterManifest> {
    const root = this.root;
    const manifestFile = path.join(root, 'character.json');
    const existing = await readJsonIfExists<CharacterManifest>(manifestFile);
    if (existing?.version === CHARACTER_VERSION) return existing;
    await ensureDir(root);
    const files: Record<string, string> = {};
    for (const pose of POSES) {
      for (const expression of EXPRESSIONS) {
        const name = `${pose}__${expression}.svg`;
        await writeFileAtomic(path.join(root, name), mascotSvg(pose, expression));
        files[`${pose}/${expression}`] = name;
      }
    }
    const manifest: CharacterManifest = {
      id: 'nummo',
      name: 'Nummo',
      version: CHARACTER_VERSION,
      description: 'Original white egg-shaped mascot with simple black eyes and a small green sprout. Thin rounded limbs, thick dark outline.',
      viewBox: { width: 400, height: 620 },
      poses: POSES,
      expressions: EXPRESSIONS,
      palette: { body: '#F7F7F9', outline: '#0B0B0D', sprout: DEFAULT_THEME.positive, accent: DEFAULT_THEME.accent },
      files,
    };
    await writeJson(manifestFile, manifest);
    return manifest;
  }

  referenceSheetPath(): string {
    return path.join(this.root, 'reference-sheet.png');
  }

  async hasReferenceSheet(): Promise<boolean> {
    return exists(this.referenceSheetPath());
  }

  /** Copy the pose/expression combinations a storyboard uses into the project's characters/ folder. */
  async exportForProject(sb: Storyboard, projectCharactersDir: string): Promise<string[]> {
    const manifest = await this.ensure();
    await ensureDir(projectCharactersDir);
    const used = new Set<string>();
    for (const s of sb.scenes) if (s.character.visible) used.add(`${s.character.pose}/${s.character.expression}`);
    const copied: string[] = [];
    for (const key of used) {
      const file = manifest.files[key];
      if (!file) continue;
      await fsp.copyFile(path.join(this.root, file), safeJoin(projectCharactersDir, file));
      copied.push(file);
    }
    await writeJson(safeJoin(projectCharactersDir, 'character.json'), { ...manifest, usedInProject: [...used] });
    return copied;
  }
}

/** Write the vector illustrations a storyboard uses into the project's illustrations/ folder. */
export async function exportVectorIllustrations(sb: Storyboard, dir: string, accent: string): Promise<string[]> {
  await ensureDir(dir);
  const used = new Set<PropAsset>();
  for (const s of sb.scenes) for (const p of s.props) used.add(p.asset);
  const out: string[] = [];
  for (const asset of used) {
    if (!PROP_ASSETS.includes(asset)) continue;
    const name = `${asset}.svg`;
    await writeFileAtomic(safeJoin(dir, name), propSvg(asset, accent));
    out.push(name);
  }
  return out;
}
