import { createRequire } from 'node:module';

/**
 * eSpeak-NG compiled to WebAssembly: turns text into IPA phonemes, exactly the
 * representation Piper voices were trained on. No native binary needed.
 */
type ESpeakFactory = (opts: { arguments: string[]; print?: (s: string) => void; printErr?: (s: string) => void }) => Promise<{
  FS: { readFile(path: string, opts: { encoding: 'utf8' }): string };
}>;

let factoryPromise: Promise<ESpeakFactory> | undefined;
const cache = new Map<string, string>();

async function loadFactory(): Promise<ESpeakFactory> {
  // espeak-ng ships as an ES module; dynamic import keeps CJS bundles working.
  factoryPromise ??= (async () => {
    const require_ = createRequire(typeof __filename !== 'undefined' ? __filename : import.meta.url);
    const entry = require_.resolve('espeak-ng');
    const { pathToFileURL } = await import('node:url');
    const mod = (await import(/* @vite-ignore */ pathToFileURL(entry).href)) as { default: ESpeakFactory };
    return mod.default;
  })();
  return factoryPromise;
}

/** Phonemize one clause (no clause punctuation inside). Returns IPA with stress marks. */
export async function phonemizeClause(text: string, espeakVoice: string): Promise<string> {
  const key = `${espeakVoice}\u0000${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const ESpeak = await loadFactory();
  const instance = await ESpeak({
    arguments: ['--phonout', 'out.txt', '-q', '--ipa', '-v', espeakVoice, text],
    print: () => {},
    printErr: () => {},
  });
  const out = instance.FS.readFile('out.txt', { encoding: 'utf8' })
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ');
  if (cache.size > 5000) cache.clear();
  cache.set(key, out);
  return out;
}
