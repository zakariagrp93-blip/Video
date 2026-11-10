import fs from 'node:fs';
import path from 'node:path';

/**
 * Logger that redacts secrets. Every registered secret value is replaced, and
 * common API-key shapes are masked even if they were never registered.
 */
const registeredSecrets = new Set<string>();

const KEY_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{8,}/g,
  /sk-(?:proj-)?[A-Za-z0-9_-]{16,}/g,
  /xi-api-key["':\s]+[A-Za-z0-9]{16,}/gi,
  /(authorization["':\s]+bearer\s+)[A-Za-z0-9._-]{12,}/gi,
  /(x-api-key["':\s]+)[A-Za-z0-9._-]{12,}/gi,
];

export function registerSecret(value: string | undefined | null): void {
  if (value && value.length >= 6) registeredSecrets.add(value);
}

export function redact(text: string): string {
  let out = text;
  for (const s of registeredSecrets) out = out.split(s).join('[REDACTED]');
  for (const re of KEY_PATTERNS) {
    out = out.replace(re, (_m, prefix?: string) => (typeof prefix === 'string' ? `${prefix}[REDACTED]` : '[REDACTED]'));
  }
  return out;
}

type Level = 'debug' | 'info' | 'warn' | 'error';

let logFile: string | undefined;
export function setLogFile(file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  logFile = file;
}

function format(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.message}\n${a.stack ?? ''}`;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

function write(level: Level, scope: string, args: unknown[]): void {
  const line = redact(`${new Date().toISOString()} [${level.toUpperCase()}] [${scope}] ${format(args)}`);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (process.env.FVS_QUIET !== '1') console.log(line);
  if (logFile) {
    try {
      fs.appendFileSync(logFile, `${line}\n`);
    } catch {
      /* logging must never crash the app */
    }
  }
}

export interface Logger {
  debug(...a: unknown[]): void;
  info(...a: unknown[]): void;
  warn(...a: unknown[]): void;
  error(...a: unknown[]): void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (...a) => process.env.FVS_DEBUG === '1' && write('debug', scope, a),
    info: (...a) => write('info', scope, a),
    warn: (...a) => write('warn', scope, a),
    error: (...a) => write('error', scope, a),
  };
}
