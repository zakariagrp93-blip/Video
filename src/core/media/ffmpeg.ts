import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { CancelledError } from '../util/errors';
import { createLogger } from '../util/logger';

const log = createLogger('ffmpeg');
const require_ = createRequire(typeof __filename !== 'undefined' ? __filename : import.meta.url);

export interface MediaBinaries {
  ffmpeg: string;
  ffprobe: string;
}

/** Electron packs node_modules in app.asar; binaries live in app.asar.unpacked. */
function unpacked(p: string): string {
  return p.replace(`app.asar${pathSep()}`, `app.asar.unpacked${pathSep()}`);
}
function pathSep(): string {
  return process.platform === 'win32' ? '\\' : '/';
}

function tryResolve(fn: () => string | null | undefined): string | undefined {
  try {
    const p = fn();
    if (p && fs.existsSync(unpacked(p))) return unpacked(p);
  } catch {
    /* not installed */
  }
  return undefined;
}

/**
 * Resolution order: explicit setting -> FVS_FFMPEG/FVS_FFPROBE env -> bundled
 * ffmpeg-static / ffprobe-static -> binaries on PATH.
 */
export function resolveMediaBinaries(ffmpegSetting = ''): MediaBinaries {
  const ffmpeg =
    (ffmpegSetting && fs.existsSync(ffmpegSetting) ? ffmpegSetting : undefined) ??
    process.env.FVS_FFMPEG ??
    tryResolve(() => require_('ffmpeg-static') as string) ??
    'ffmpeg';
  let ffprobe = process.env.FVS_FFPROBE;
  if (!ffprobe && ffmpegSetting) {
    const sibling = ffmpegSetting.replace(/ffmpeg(\.exe)?$/i, (_m, ext?: string) => `ffprobe${ext ?? ''}`);
    if (sibling !== ffmpegSetting && fs.existsSync(sibling)) ffprobe = sibling;
  }
  ffprobe ??= tryResolve(() => (require_('ffprobe-static') as { path: string }).path) ?? 'ffprobe';
  return { ffmpeg, ffprobe };
}

export interface RunOptions {
  signal?: AbortSignal;
  /** Called with seconds of media processed, parsed from ffmpeg's -progress output. */
  onProgress?: (seconds: number) => void;
  cwd?: string;
}

export function runProcess(bin: string, args: string[], opts: RunOptions = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new CancelledError());
    const child = spawn(bin, args, { cwd: opts.cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const onAbort = () => child.kill('SIGKILL');
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (d: Buffer) => {
      const s = d.toString();
      stdout += s;
      if (opts.onProgress) {
        const m = /out_time_us=(\d+)/.exec(s);
        if (m) opts.onProgress(Number(m[1]) / 1e6);
      }
      if (stdout.length > 4_000_000) stdout = stdout.slice(-1_000_000);
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });
    child.on('error', (err) => {
      opts.signal?.removeEventListener('abort', onAbort);
      reject(new Error(`Could not start ${bin}: ${err.message}. Configure the FFmpeg path in Settings.`));
    });
    child.on('close', (code) => {
      opts.signal?.removeEventListener('abort', onAbort);
      if (opts.signal?.aborted) return reject(new CancelledError());
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin.split(/[\\/]/).pop()} exited with code ${code}: ${stderr.trim().split('\n').slice(-6).join('\n')}`));
    });
  });
}

export class FFmpeg {
  constructor(public readonly bins: MediaBinaries) {}

  run(args: string[], opts: RunOptions = {}): Promise<{ stdout: string; stderr: string }> {
    const full = ['-hide_banner', '-nostdin', '-y', ...(opts.onProgress ? ['-progress', 'pipe:1', '-nostats'] : []), ...args];
    log.debug('ffmpeg', full.join(' '));
    return runProcess(this.bins.ffmpeg, full, opts);
  }

  async probe(file: string): Promise<ProbeResult> {
    const { stdout } = await runProcess(this.bins.ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
    const json = JSON.parse(stdout) as {
      format?: { duration?: string; size?: string; format_name?: string; bit_rate?: string };
      streams?: Array<Record<string, unknown>>;
    };
    const streams = (json.streams ?? []).map((s) => ({
      codecType: String(s.codec_type ?? ''),
      codecName: String(s.codec_name ?? ''),
      width: s.width as number | undefined,
      height: s.height as number | undefined,
      frameRate: parseRate(String(s.avg_frame_rate ?? s.r_frame_rate ?? '0/1')),
      sampleRate: s.sample_rate ? Number(s.sample_rate) : undefined,
      channels: s.channels as number | undefined,
      duration: s.duration ? Number(s.duration) : undefined,
      pixFmt: s.pix_fmt as string | undefined,
      nbFrames: s.nb_frames ? Number(s.nb_frames) : undefined,
    }));
    return {
      duration: Number(json.format?.duration ?? 0),
      size: Number(json.format?.size ?? 0),
      formatName: json.format?.format_name ?? '',
      streams,
    };
  }

  async version(): Promise<string> {
    const { stdout } = await runProcess(this.bins.ffmpeg, ['-version']);
    return stdout.split('\n')[0] ?? '';
  }
}

export interface ProbeResult {
  duration: number;
  size: number;
  formatName: string;
  streams: Array<{
    codecType: string;
    codecName: string;
    width?: number;
    height?: number;
    frameRate: number;
    sampleRate?: number;
    channels?: number;
    duration?: number;
    pixFmt?: string;
    nbFrames?: number;
  }>;
}

function parseRate(r: string): number {
  const [a, b] = r.split('/').map(Number);
  if (!a || !b) return 0;
  return a / b;
}
