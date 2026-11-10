// Pre-bundles the Remotion compositions at build time. The packaged app renders
// from this static bundle, so no webpack runs on the user's machine.
import { bundle } from '@remotion/bundler';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'build', 'remotion-bundle');
fs.rmSync(outDir, { recursive: true, force: true });
const t0 = Date.now();
const serveUrl = await bundle({
  entryPoint: path.join(root, 'src', 'remotion', 'index.ts'),
  outDir,
  enableCaching: false,
  onProgress: (p) => process.stdout.write(`\rBundling Remotion compositions… ${p}%`),
});
process.stdout.write('\n');
console.log(`Remotion bundle ready at ${serveUrl} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
