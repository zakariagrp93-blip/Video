import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { safeJoin } from '../util/fsx';

const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

/**
 * Serves a project's generated illustrations to the headless renderer over
 * 127.0.0.1 (browsers refuse file:// from an http page). Read-only, scoped to one folder.
 */
export async function startAssetServer(root: string): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    try {
      const rel = decodeURIComponent((req.url ?? '/').split('?')[0]!.replace(/^\/+/, ''));
      const file = safeJoin(root, rel);
      const type = TYPES[path.extname(file).toLowerCase()];
      if (!type || !fs.existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': type, 'access-control-allow-origin': '*', 'cache-control': 'no-cache' });
      fs.createReadStream(file).pipe(res);
    } catch {
      res.writeHead(400).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
