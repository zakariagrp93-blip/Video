import type { Language } from '../../shared/constants';
import type { WordTiming } from '../../shared/schemas';
import { normalizeForSpeech, pauseWeight, tokenSyllables } from '../text/speech';

export interface Interval {
  start: number;
  end: number;
}

/** Energy-based silence detection on 10 ms frames. */
export function detectSilences(samples: Float32Array, sampleRate: number, minSilence = 0.11): { silences: Interval[]; speechStart: number; speechEnd: number } {
  const frame = Math.max(1, Math.round(sampleRate * 0.01));
  const n = Math.floor(samples.length / frame);
  const energies = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let i = f * frame; i < (f + 1) * frame; i++) s += samples[i]! * samples[i]!;
    energies[f] = Math.sqrt(s / frame);
  }
  const sorted = Array.from(energies).sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const threshold = Math.max(0.006, p95 * 0.08);
  let first = 0;
  while (first < n && energies[first]! < threshold) first++;
  let last = n - 1;
  while (last > first && energies[last]! < threshold) last--;
  const silences: Interval[] = [];
  let runStart = -1;
  for (let f = first; f <= last; f++) {
    const quiet = energies[f]! < threshold;
    if (quiet && runStart < 0) runStart = f;
    if ((!quiet || f === last) && runStart >= 0) {
      const len = (f - runStart) * 0.01;
      if (len >= minSilence) silences.push({ start: runStart * 0.01, end: f * 0.01 });
      runStart = -1;
    }
  }
  return { silences, speechStart: first * 0.01, speechEnd: Math.min(samples.length / sampleRate, (last + 1) * 0.01) };
}

function spokenWordCount(token: string, lang: Language): number {
  return normalizeForSpeech(token, lang)
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Map provider word timings (spoken form) onto display tokens. Returns null on mismatch. */
export function mapProviderWords(tokens: string[], words: WordTiming[], lang: Language): WordTiming[] | null {
  const counts = tokens.map((t) => spokenWordCount(t, lang));
  const total = counts.reduce((a, b) => a + b, 0);
  if (total !== words.length || total === 0) return null;
  const out: WordTiming[] = [];
  let w = 0;
  for (let i = 0; i < tokens.length; i++) {
    const c = counts[i]!;
    if (c === 0) {
      const prev = out[out.length - 1];
      const t = prev ? prev.end : (words[0]?.start ?? 0);
      out.push({ text: tokens[i]!, start: t, end: t });
      continue;
    }
    out.push({ text: tokens[i]!, start: words[w]!.start, end: words[w + c - 1]!.end });
    w += c;
  }
  return out;
}

/** Distribute tokens over [start, end] proportionally to spoken syllables. */
function distribute(tokens: string[], start: number, end: number, lang: Language): WordTiming[] {
  const weights = tokens.map((t, i) => tokenSyllables(t, lang) + (i < tokens.length - 1 ? pauseWeight(t) * 0.5 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const out: WordTiming[] = [];
  let t = start;
  for (let i = 0; i < tokens.length; i++) {
    const d = ((end - start) * weights[i]!) / total;
    out.push({ text: tokens[i]!, start: t, end: t + d });
    t += d;
  }
  return out;
}

export interface AlignResult {
  words: WordTiming[];
  method: 'provider-words' | 'provider-chars' | 'silence-anchored' | 'proportional';
}

/**
 * Align display tokens of one utterance to its audio.
 * 1. Provider timestamps when available and consistent.
 * 2. Otherwise phrase boundaries (punctuation) are snapped to detected pauses with
 *    a small dynamic program, and words inside each phrase are weighted by syllables.
 */
export function alignUtterance(
  tokens: string[],
  samples: Float32Array,
  sampleRate: number,
  lang: Language,
  provider?: { words: WordTiming[]; kind: 'provider-words' | 'provider-chars' },
): AlignResult {
  if (tokens.length === 0) return { words: [], method: 'proportional' };
  if (provider?.words.length) {
    const mapped = mapProviderWords(tokens, provider.words, lang);
    if (mapped) return { words: mapped, method: provider.kind };
  }
  const { silences, speechStart, speechEnd } = detectSilences(samples, sampleRate);
  const syl = tokens.map((t) => tokenSyllables(t, lang) + pauseWeight(t));
  const totalSyl = syl.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(0.05, speechEnd - speechStart);

  // Phrase breaks after tokens that end in clause punctuation (excluding the last token).
  const breaks: number[] = [];
  for (let i = 0; i < tokens.length - 1; i++) if (/[,;:.!?…—]$/.test(tokens[i]!)) breaks.push(i);
  if (breaks.length === 0 || silences.length === 0) {
    return { words: distribute(tokens, speechStart, speechEnd, lang), method: 'proportional' };
  }

  // Expected time of each break if speech were uniform in syllables.
  const cum: number[] = [];
  let acc = 0;
  for (const s of syl) cum.push((acc += s));
  const expected = breaks.map((i) => speechStart + (cum[i]! / totalSyl) * span);
  const centers = silences.map((s) => (s.start + s.end) / 2);
  const tol = Math.max(0.35, span * 0.22);
  const P = tol * tol; // cost of leaving a break unanchored
  const k = breaks.length;
  const m = silences.length;
  const dp: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  const choice: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let j = 0; j <= m; j++) dp[0]![j] = 0;
  for (let i = 1; i <= k; i++) {
    dp[i]![0] = dp[i - 1]![0]! + P;
    choice[i]![0] = 1;
    for (let j = 1; j <= m; j++) {
      const skip = dp[i]![j - 1]!;
      const unanchored = dp[i - 1]![j]! + P;
      const d = centers[j - 1]! - expected[i - 1]!;
      const anchor = Math.abs(d) <= tol ? dp[i - 1]![j - 1]! + d * d : Infinity;
      let best = skip;
      let c = 0;
      if (unanchored < best) {
        best = unanchored;
        c = 1;
      }
      if (anchor < best) {
        best = anchor;
        c = 2;
      }
      dp[i]![j] = best;
      choice[i]![j] = c;
    }
  }
  // Backtrack
  const anchors: Array<Interval | null> = new Array(k).fill(null);
  let i = k;
  let j = m;
  while (i > 0) {
    const c = choice[i]![j]!;
    if (j === 0 || c === 1) {
      i -= 1;
    } else if (c === 2) {
      anchors[i - 1] = silences[j - 1]!;
      i -= 1;
      j -= 1;
    } else {
      j -= 1;
    }
  }
  const anchoredCount = anchors.filter(Boolean).length;
  if (anchoredCount === 0) return { words: distribute(tokens, speechStart, speechEnd, lang), method: 'proportional' };

  // Build phrases and their time spans.
  const words: WordTiming[] = [];
  let phraseStartToken = 0;
  let phraseStartTime = speechStart;
  for (let b = 0; b <= k; b++) {
    const endToken = b < k ? breaks[b]! : tokens.length - 1;
    const anchor = b < k ? anchors[b] : null;
    if (b < k && !anchor) continue; // merge with next phrase
    const phraseEnd = anchor ? anchor.start : speechEnd;
    const slice = tokens.slice(phraseStartToken, endToken + 1);
    words.push(...distribute(slice, phraseStartTime, Math.max(phraseStartTime + 0.05, phraseEnd), lang));
    phraseStartToken = endToken + 1;
    phraseStartTime = anchor ? anchor.end : speechEnd;
  }
  return { words, method: 'silence-anchored' };
}
