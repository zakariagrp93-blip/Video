import crypto from 'node:crypto';

/** JSON.stringify with sorted keys, so semantically-equal objects hash identically. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function sha256(input: string | Uint8Array): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hashOf(value: unknown, length = 16): string {
  return sha256(stableStringify(value)).slice(0, length);
}

export function newId(prefix = ''): string {
  const t = Date.now().toString(36);
  const r = crypto.randomBytes(5).toString('hex');
  return `${prefix}${t}-${r}`;
}
