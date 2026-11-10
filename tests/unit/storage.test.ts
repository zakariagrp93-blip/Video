import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AssetCache } from '../../src/core/assets/assetCache';
import { estimateCost } from '../../src/core/cost/costTracker';
import { AppDatabase } from '../../src/core/db/database';
import { SecretStore, SettingsStore, type SecretCipher } from '../../src/core/settings/settingsStore';
import { Studio, defaultPaths } from '../../src/core/studio';
import { safeJoin } from '../../src/core/util/fsx';
import { redact, registerSecret } from '../../src/core/util/logger';
import { SettingsSchema } from '../../src/shared/schemas';

const xorCipher: SecretCipher = {
  available: true,
  encrypt: (p) => Buffer.from([...Buffer.from(p)].map((b) => b ^ 0x5a)),
  decrypt: (d) => Buffer.from([...d].map((b) => b ^ 0x5a)).toString(),
};

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fvs-store-'));

describe('project persistence', () => {
  it('reopens projects, settings and history after a restart', async () => {
    const dir = tmp();
    const paths = defaultPaths(dir, path.resolve('build/remotion-bundle'));
    const a = await Studio.create({ paths, cipher: xorCipher });
    const p = await a.projects.create({ topic: 'What if you received €1 million at age 18?', duration: '60', language: 'fr', narrator: 'auto', storytelling: 'hypothetical', visualStyle: 'minimal-finance' });
    await a.settings.update({ musicVolume: 0.25, defaultLanguage: 'en' });
    await a.secrets.set('openaiApiKey', 'sk-proj-persisted-key-123456');
    // Simulate a crash mid-generation
    const project = await a.projects.get(p.id);
    project.status = 'running';
    project.stages.voice = { status: 'running', attempts: 1 };
    await a.projects.save(project);
    await a.close();

    const raw = fs.readFileSync(path.join(dir, 'secrets.json'), 'utf8');
    expect(raw).not.toContain('sk-proj-persisted-key');

    const b = await Studio.create({ paths, cipher: xorCipher });
    const list = await b.projects.list();
    expect(list.map((x) => x.id)).toContain(p.id);
    expect(b.settings.get().musicVolume).toBe(0.25);
    expect(b.secrets.get('openaiApiKey')).toBe('sk-proj-persisted-key-123456');
    const recovered = await b.projects.get(p.id);
    expect(recovered.status).toBe('failed');
    expect(recovered.failedStage).toBe('voice');
    expect(recovered.error).toMatch(/Retry/);
    expect(b.projects.history().some((h) => h.kind === 'created' && h.projectId === p.id)).toBe(true);

    // Re-index project folders if the database is lost.
    await b.close();
    fs.rmSync(path.join(dir, 'studio.sqlite'));
    const c = await Studio.create({ paths, cipher: xorCipher });
    expect((await c.projects.list()).map((x) => x.id)).toContain(p.id);
    await c.close();
  });

  it('refuses to store keys when secure storage is unavailable', async () => {
    const s = new SecretStore(null, { available: false, encrypt: () => Buffer.alloc(0), decrypt: () => '' });
    await expect(s.set('anthropicApiKey', 'sk-ant-1234567890')).rejects.toThrow(/Secure storage/);
  });

  it('falls back to defaults for corrupt settings', () => {
    const dir = tmp();
    const f = path.join(dir, 'settings.json');
    fs.writeFileSync(f, '{not json');
    expect(new SettingsStore(f).get()).toEqual(SettingsSchema.parse({}));
  });
});

describe('safety utilities', () => {
  it('blocks path traversal', () => {
    expect(() => safeJoin('/data/projects', '../etc/passwd')).toThrow();
    expect(() => safeJoin('/data/projects', '/etc/passwd')).toThrow();
    expect(() => safeJoin('C:\\data', 'C:\\Windows')).toThrow();
    expect(safeJoin('/data/projects', 'p1', 'final.mp4')).toBe(path.resolve('/data/projects/p1/final.mp4'));
  });
  it('redacts API keys from logs', () => {
    registerSecret('my-very-secret-value');
    expect(redact('using key my-very-secret-value now')).toBe('using key [REDACTED] now');
    expect(redact('x-api-key: sk-ant-api03-abcdefghijklmnop')).not.toContain('abcdefghijklmnop');
    expect(redact('Authorization: Bearer sk-proj-ABCDEFGHIJKLMNOPQRS')).not.toContain('ABCDEFGHIJKLMNOPQRS');
  });
});

describe('cost tracking', () => {
  const pricing = SettingsSchema.parse({}).pricing;
  it('estimates from configured prices and never invents unknown ones', () => {
    expect(estimateCost({ provider: 'anthropic', kind: 'llm', units: 0, unitType: 'tokens', inputTokens: 1_000_000, outputTokens: 100_000 }, pricing)).toBeCloseTo(4 + 2);
    expect(estimateCost({ provider: 'openai', kind: 'image', units: 2, unitType: 'images' }, pricing)).toBeNull();
    expect(estimateCost({ provider: 'piper', kind: 'tts', units: 500, unitType: 'characters' }, pricing)).toBe(0);
    expect(estimateCost({ provider: 'anthropic', kind: 'llm', units: 0, unitType: 'tokens', inputTokens: 999, cached: true }, pricing)).toBe(0);
  });
});

describe('asset cache', () => {
  it('stores, hits and evicts least-recently-used entries', async () => {
    const dir = tmp();
    const db = await AppDatabase.open(null);
    const cache = new AssetCache(dir, db, () => true, () => 25);
    await cache.put('images', 'aaa', 'png', Buffer.alloc(10), 't');
    await new Promise((r) => setTimeout(r, 5));
    await cache.put('images', 'bbb', 'png', Buffer.alloc(10), 't');
    await new Promise((r) => setTimeout(r, 5));
    expect(await cache.get('images', 'aaa', 'png')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 5));
    await cache.put('images', 'ccc', 'png', Buffer.alloc(10), 't');
    expect(await cache.get('images', 'bbb', 'png')).toBeUndefined();
    expect(await cache.get('images', 'aaa', 'png')).toBeTruthy();
    await expect(cache.get('../x', 'a', 'png')).rejects.toThrow();
  });
});
