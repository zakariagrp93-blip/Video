import fs from 'node:fs';
import fsp from 'node:fs/promises';
import OpenAI, { toFile } from 'openai';
import { ProviderError } from '../../util/errors';
import { hashOf } from '../../util/hash';
import { getFetchImplementation } from '../../util/http';
import type { ConnectionTestResult, GeneratedImage, IllustrationRequest, ImageProvider, ProviderContext } from '../types';

/** Style suffix keeping AI art consistent with the vector library and mascot. */
export const ART_DIRECTION =
  'Flat 2D minimalist cartoon illustration, clean bold white shapes with thin black outlines and a single yellow accent, no text, no gradients, no shadows, centered object, isolated on a plain pure black background, high contrast, simple and readable at small size.';

/**
 * Built-in vector library: every object is an SVG component rendered by Remotion.
 * Zero cost, perfectly consistent; returns null so callers use the vector asset.
 */
export class VectorImageProvider implements ImageProvider {
  readonly id = 'vector';
  readonly label = 'Built-in vector library (free)';
  readonly isLocal = true;
  readonly supportsReferences = false;
  checkReady(): string | null {
    return null;
  }
  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, message: 'Vector library is built in.' };
  }
  async generateIllustration(): Promise<GeneratedImage | null> {
    return null;
  }
  async generateCharacter(): Promise<GeneratedImage | null> {
    return null;
  }
  async generateFromReference(): Promise<GeneratedImage | null> {
    return null;
  }
}

/** OpenAI image generation (gpt-image models), cached by prompt hash. */
export class OpenAIImageProvider implements ImageProvider {
  readonly id = 'openai';
  readonly label = 'OpenAI Images';
  readonly isLocal = false;
  readonly supportsReferences = true;

  constructor(
    private readonly apiKey: () => string | undefined,
    private readonly model: () => string,
  ) {}

  private client(): OpenAI {
    const key = this.apiKey();
    if (!key) throw new ProviderError('openai', 'API key not configured');
    return new OpenAI({ apiKey: key, fetch: getFetchImplementation() as never, maxRetries: 1, timeout: 5 * 60 * 1000 });
  }

  checkReady(): string | null {
    return this.apiKey() ? null : 'OpenAI API key is not set (Settings → API keys).';
  }

  async testConnection(ctx: ProviderContext): Promise<ConnectionTestResult> {
    if (!this.apiKey()) return { ok: false, message: 'No API key configured.' };
    try {
      await this.client().models.retrieve(this.model(), { signal: ctx.signal });
      return { ok: true, message: `Connected. Model ${this.model()} is available.` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  private async cached(key: string, ctx: ProviderContext, make: () => Promise<Buffer>): Promise<GeneratedImage> {
    const hit = await ctx.cache.get('images', key, 'png');
    if (hit) {
      ctx.usage({ provider: 'openai', kind: 'image', model: this.model(), units: 1, unitType: 'images', cached: true });
      return { data: await fsp.readFile(hit), cached: true };
    }
    let data: Buffer;
    try {
      data = await make();
    } catch (err) {
      ctx.usage({ provider: 'openai', kind: 'image', model: this.model(), units: 0, unitType: 'images', ok: false });
      const status = (err as { status?: number }).status;
      throw new ProviderError('openai', (err as Error).message, status, status === 429 || (status ?? 0) >= 500);
    }
    await ctx.cache.put('images', key, 'png', data, 'openai');
    ctx.usage({ provider: 'openai', kind: 'image', model: this.model(), units: 1, unitType: 'images' });
    return { data, cached: false };
  }

  async generateIllustration(req: IllustrationRequest, ctx: ProviderContext): Promise<GeneratedImage | null> {
    const prompt = `${req.prompt}. ${ART_DIRECTION}`;
    const key = hashOf({ m: this.model(), p: prompt, t: req.transparent ?? true }, 32);
    return this.cached(key, ctx, async () => {
      const res = await this.client().images.generate(
        { model: this.model(), prompt, size: '1024x1024', background: req.transparent === false ? 'opaque' : 'transparent', output_format: 'png', n: 1 },
        { signal: ctx.signal },
      );
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new ProviderError('openai', 'No image returned');
      return Buffer.from(b64, 'base64');
    });
  }

  generateCharacter(req: IllustrationRequest, ctx: ProviderContext): Promise<GeneratedImage | null> {
    return req.referenceFile ? this.generateFromReference({ ...req, referenceFile: req.referenceFile }, ctx) : this.generateIllustration(req, ctx);
  }

  async generateFromReference(req: IllustrationRequest & { referenceFile: string }, ctx: ProviderContext): Promise<GeneratedImage | null> {
    const prompt = `${req.prompt}. Keep exactly the same character design, proportions and line style as the reference image. ${ART_DIRECTION}`;
    const refHash = hashOf(fs.readFileSync(req.referenceFile).toString('base64'), 16);
    const key = hashOf({ m: this.model(), p: prompt, r: refHash }, 32);
    return this.cached(key, ctx, async () => {
      const image = await toFile(fs.createReadStream(req.referenceFile), 'reference.png', { type: 'image/png' });
      const res = await this.client().images.edit({ model: this.model(), image, prompt, size: '1024x1024', background: 'transparent', output_format: 'png' } as never, { signal: ctx.signal });
      const b64 = (res as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json;
      if (!b64) throw new ProviderError('openai', 'No image returned');
      return Buffer.from(b64, 'base64');
    });
  }
}
