// Bundles the Electron main + preload processes (and the headless CLI) with esbuild.
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * Packages that ship native binaries, WebAssembly or that locate files relative
 * to their own folder must stay external (loaded from node_modules at runtime).
 */
const external = [
  'electron',
  '@remotion/renderer',
  '@remotion/bundler',
  '@remotion/compositor-*',
  'onnxruntime-node',
  'sql.js',
  'espeak-ng',
  'ffmpeg-static',
  'ffprobe-static',
];

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: 'linked',
  external,
  jsx: 'automatic',
  logOverride: { 'empty-import-meta': 'silent' },
  define: { 'process.env.NODE_ENV': '"production"' },
};

await Promise.all([
  build({ ...common, entryPoints: [path.join(root, 'electron/main.ts')], outfile: path.join(root, 'dist/main/main.cjs') }),
  build({ ...common, entryPoints: [path.join(root, 'electron/preload.ts')], outfile: path.join(root, 'dist/main/preload.cjs') }),
  build({ ...common, entryPoints: [path.join(root, 'src/cli/generate.ts')], outfile: path.join(root, 'dist/cli/generate.cjs'), banner: { js: '#!/usr/bin/env node' } }),
]);
console.log('Main, preload and CLI bundles built.');
