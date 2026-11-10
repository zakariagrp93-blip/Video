import type { CaptionCue, CaptionWord, NarrationManifest, PlannedScene, WordTiming } from '../../shared/schemas';

export interface CaptionOptions {
  fps: number;
  maxWordsPerCue: number;
  maxCharsPerCue: number;
  minCueSeconds: number;
  holdSeconds: number;
}

export const DEFAULT_CAPTION_OPTIONS: CaptionOptions = {
  fps: 30,
  maxWordsPerCue: 3,
  maxCharsPerCue: 18,
  minCueSeconds: 0.4,
  holdSeconds: 0.25,
};

export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

const AUTO_ACCENT = /\d|[€$£%]/;

export function toneFor(word: string, emphasis: string[], negative: string[]): CaptionWord['tone'] {
  const n = normalizeWord(word);
  if (!n) return 'normal';
  const neg = negative.flatMap((x) => x.split(/\s+/)).map(normalizeWord).filter(Boolean);
  if (neg.includes(n)) return 'danger';
  const emp = emphasis.flatMap((x) => x.split(/\s+/)).map(normalizeWord).filter(Boolean);
  if (emp.includes(n) || AUTO_ACCENT.test(word)) return 'accent';
  return 'normal';
}

export interface TimedWord extends WordTiming {
  sceneIndex: number;
}

/** Absolute word timings for the whole video, scene by scene. */
export function absoluteWords(manifest: NarrationManifest, sceneIds: string[]): TimedWord[] {
  const out: TimedWord[] = [];
  for (const seg of manifest.segments) {
    const sceneIndex = sceneIds.indexOf(seg.sceneId);
    for (const w of seg.words) out.push({ text: w.text, start: seg.start + w.start, end: seg.start + w.end, sceneIndex });
  }
  return out;
}

/**
 * Group words into short, readable cues (1–3 words), never crossing a scene
 * boundary, breaking after punctuation, with a short hold after the last word.
 */
export function buildCaptions(words: TimedWord[], scenes: PlannedScene[], opts: CaptionOptions = DEFAULT_CAPTION_OPTIONS): CaptionCue[] {
  const groups: TimedWord[][] = [];
  let cur: TimedWord[] = [];
  const flush = () => {
    if (cur.length) groups.push(cur);
    cur = [];
  };
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const chars = cur.reduce((a, x) => a + x.text.length + 1, 0) + w.text.length;
    if (prev && (prev.sceneIndex !== w.sceneIndex || cur.length >= opts.maxWordsPerCue || chars > opts.maxCharsPerCue || w.start - prev.end > 0.6)) {
      flush();
    }
    cur.push(w);
    if (/[.!?…,;:]$/.test(w.text)) flush();
  }
  flush();

  const f = (s: number) => Math.max(0, Math.round(s * opts.fps));
  const cues: CaptionCue[] = [];
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]!;
    const scene = scenes[group[0]!.sceneIndex];
    const sceneEnd = scene ? scene.startFrame + scene.durationInFrames : Infinity;
    const next = groups[g + 1];
    const start = f(group[0]!.start);
    let end = f(group[group.length - 1]!.end + opts.holdSeconds);
    end = Math.max(end, start + f(opts.minCueSeconds));
    if (next) end = Math.min(end, f(next[0]!.start));
    end = Math.min(end, sceneEnd);
    if (end <= start) end = start + 1;
    cues.push({
      startFrame: start,
      endFrame: end,
      words: group.map((w) => {
        const sc = scenes[w.sceneIndex];
        return {
          text: w.text,
          startFrame: f(w.start),
          endFrame: Math.max(f(w.start) + 1, f(w.end)),
          tone: toneFor(w.text, sc?.emphasis ?? [], sc?.negative ?? []),
        };
      }),
    });
  }
  return cues;
}

function srtTime(sec: number): string {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(r).padStart(3, '0')}`;
}

export function toSrt(cues: CaptionCue[], fps: number): string {
  return cues
    .map((c, i) => `${i + 1}\n${srtTime(c.startFrame / fps)} --> ${srtTime(c.endFrame / fps)}\n${c.words.map((w) => w.text).join(' ')}\n`)
    .join('\n');
}

/** Sanity checks used by the pipeline and tests. */
export function validateCaptions(cues: CaptionCue[], durationInFrames: number): string[] {
  const issues: string[] = [];
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i]!;
    if (c.endFrame <= c.startFrame) issues.push(`Cue ${i} has non-positive duration`);
    if (c.endFrame > durationInFrames) issues.push(`Cue ${i} ends after the video`);
    if (i > 0 && c.startFrame < cues[i - 1]!.endFrame) issues.push(`Cue ${i} overlaps the previous cue`);
    for (let j = 1; j < c.words.length; j++) {
      if (c.words[j]!.startFrame < c.words[j - 1]!.startFrame) issues.push(`Cue ${i} words are out of order`);
    }
  }
  return issues;
}
