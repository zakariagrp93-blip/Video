import fs from 'node:fs';
import { SECRET_KEYS, SettingsSchema, type SecretKey, type SecretStatus, type Settings } from '../../shared/schemas';
import { writeJson } from '../util/fsx';
import { registerSecret } from '../util/logger';

/**
 * Encrypts/decrypts secret strings. In Electron this is backed by `safeStorage`
 * (DPAPI on Windows). Tests use an in-memory implementation.
 */
export interface SecretCipher {
  readonly available: boolean;
  encrypt(plain: string): Buffer;
  decrypt(data: Buffer): string;
}

export class SettingsStore {
  private settings: Settings;

  constructor(private readonly file: string | null) {
    this.settings = SettingsSchema.parse({});
    if (file && fs.existsSync(file)) {
      try {
        this.settings = SettingsSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
      } catch {
        // Corrupt or outdated settings: fall back to defaults merged with whatever parses.
        const raw = safeParse(fs.readFileSync(file, 'utf8'));
        const result = SettingsSchema.safeParse(raw);
        this.settings = result.success ? result.data : SettingsSchema.parse({});
      }
    }
  }

  get(): Settings {
    return structuredClone(this.settings);
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    const next = SettingsSchema.parse({ ...this.settings, ...patch });
    this.settings = next;
    if (this.file) await writeJson(this.file, next);
    return this.get();
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * API keys never leave the main process. They are stored encrypted on disk,
 * and the renderer only ever learns whether a key is set.
 */
export class SecretStore {
  private cache = new Map<SecretKey, string>();
  /** Keys that came from environment variables: usable, but never persisted. */
  private envOnly = new Set<SecretKey>();

  constructor(
    private readonly file: string | null,
    private readonly cipher: SecretCipher,
  ) {
    if (file && fs.existsSync(file)) {
      const raw = safeParse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
      for (const key of SECRET_KEYS) {
        const enc = raw[key];
        if (!enc) continue;
        try {
          const value = cipher.decrypt(Buffer.from(enc, 'base64'));
          this.cache.set(key, value);
          registerSecret(value);
        } catch {
          /* unreadable (e.g. different Windows user) — treat as unset */
        }
      }
    }
    // Environment variables are honoured for headless/CI usage, never written to disk.
    const envMap: Record<SecretKey, string | undefined> = {
      anthropicApiKey: process.env.FVS_ANTHROPIC_API_KEY,
      openaiApiKey: process.env.FVS_OPENAI_API_KEY,
      elevenlabsApiKey: process.env.FVS_ELEVENLABS_API_KEY,
    };
    for (const key of SECRET_KEYS) {
      const v = envMap[key];
      if (v && !this.cache.has(key)) {
        this.cache.set(key, v);
        this.envOnly.add(key);
        registerSecret(v);
      }
    }
  }

  get(key: SecretKey): string | undefined {
    return this.cache.get(key);
  }

  status(): SecretStatus {
    return Object.fromEntries(SECRET_KEYS.map((k) => [k, this.cache.has(k)])) as SecretStatus;
  }

  async set(key: SecretKey, value: string | null): Promise<void> {
    if (!SECRET_KEYS.includes(key)) throw new Error('Unknown secret key');
    const trimmed = value?.trim();
    if (trimmed) {
      if (!this.cipher.available) {
        throw new Error('Secure storage is not available on this system; the key cannot be saved safely.');
      }
      this.cache.set(key, trimmed);
      registerSecret(trimmed);
    } else {
      this.cache.delete(key);
    }
    this.envOnly.delete(key);
    if (!this.file) return;
    const out: Record<string, string> = {};
    for (const [k, v] of this.cache) {
      if (!this.envOnly.has(k)) out[k] = this.cipher.encrypt(v).toString('base64');
    }
    await writeJson(this.file, out);
  }
}

/** Test/headless cipher — NOT secure, only for tests and CLI runs without persistence. */
export const memoryCipher: SecretCipher = {
  available: true,
  encrypt: (plain) => Buffer.from(plain, 'utf8'),
  decrypt: (data) => data.toString('utf8'),
};
