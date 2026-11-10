import type { Language } from '../../shared/constants';

const NBSP = ' ';
const SPACE_CHARS = /[   ]/g;

const CURRENCY_WORDS: Record<Language, { eur: [string, string]; usd: [string, string]; gbp: [string, string] }> = {
  fr: { eur: ['euro', 'euros'], usd: ['dollar', 'dollars'], gbp: ['livre', 'livres'] },
  en: { eur: ['euro', 'euros'], usd: ['dollar', 'dollars'], gbp: ['pound', 'pounds'] },
  es: { eur: ['euro', 'euros'], usd: ['dólar', 'dólares'], gbp: ['libra', 'libras'] },
  de: { eur: ['Euro', 'Euro'], usd: ['Dollar', 'Dollar'], gbp: ['Pfund', 'Pfund'] },
};
const PERCENT: Record<Language, string> = { fr: 'pour cent', en: 'percent', es: 'por ciento', de: 'Prozent' };
const PER: Record<Language, Record<string, string>> = {
  fr: { mois: 'par mois', an: 'par an', jour: 'par jour', h: 'de l’heure', semaine: 'par semaine' },
  en: { month: 'per month', year: 'per year', yr: 'per year', day: 'per day', h: 'per hour', hour: 'per hour', week: 'per week', mo: 'per month' },
  es: { mes: 'al mes', año: 'al año', día: 'al día', semana: 'a la semana' },
  de: { Monat: 'pro Monat', Jahr: 'pro Jahr', Tag: 'pro Tag', Woche: 'pro Woche' },
};
const BIG: Record<Language, RegExp> = {
  fr: /^(millions?|milliards?)$/i,
  en: /^(million|billion|thousand)s?$/i,
  es: /^(millón|millones|mil)$/i,
  de: /^(Millionen?|Milliarden?|Tausend)$/i,
};

function currencyKind(sym: string): 'eur' | 'usd' | 'gbp' | null {
  if (sym === '€' || /^eur$/i.test(sym)) return 'eur';
  if (sym === '$' || /^usd$/i.test(sym)) return 'usd';
  if (sym === '£' || /^gbp$/i.test(sym)) return 'gbp';
  return null;
}

/** Remove thousands separators so the TTS engine reads a whole number. */
function joinThousands(text: string, lang: Language): string {
  let t = text.replace(SPACE_CHARS, ' ');
  // "1 000 000" (fr/es/de) — space-grouped thousands
  t = t.replace(/\b(\d{1,3})((?: \d{3})+)\b/g, (_m, a: string, rest: string) => a + rest.replace(/ /g, ''));
  if (lang === 'en') t = t.replace(/\b(\d{1,3})((?:,\d{3})+)\b/g, (_m, a: string, rest: string) => a + rest.replace(/,/g, ''));
  else t = t.replace(/\b(\d{1,3})((?:\.\d{3})+)\b/g, (_m, a: string, rest: string) => a + rest.replace(/\./g, ''));
  return t;
}

/**
 * Turn display text ("3 750 €/mois", "€1 million", "5 %") into text every TTS
 * engine pronounces correctly ("3750 euros par mois", "1 million d'euros", "5 pour cent").
 * Subtitles keep the display form; only the audio uses this.
 */
export function normalizeForSpeech(text: string, lang: Language): string {
  let t = joinThousands(text, lang);
  const words = CURRENCY_WORDS[lang];
  const unit = (kind: 'eur' | 'usd' | 'gbp', amount: string, big?: string) => {
    const plural = big ? true : Number(amount.replace(',', '.')) !== 1;
    const w = words[kind][plural ? 1 : 0];
    if (big) {
      if (lang === 'fr') return `${amount} ${big} ${/^[aeiouy]/i.test(w) ? 'd’' : 'de '}${w}`.replace('d’ ', 'd’');
      if (lang === 'es') return `${amount} ${big} de ${w}`;
      return `${amount} ${big} ${w}`;
    }
    return `${amount} ${w}`;
  };
  // Prefix currency: €1 million, $45000, € 2.5
  t = t.replace(/([€$£])\s?(\d+(?:[.,]\d+)?)(?:\s?(million|millions|billion|billions|thousand|millón|millones|Millionen?|Milliarden?|millions?|milliards?))?/g, (_m, sym: string, amt: string, big?: string) => {
    const k = currencyKind(sym)!;
    return unit(k, amt, big);
  });
  // Suffix currency: 1 million €, 45000 €, 2,4 millions d'euros already fine
  t = t.replace(/(\d+(?:[.,]\d+)?)(?:\s?(millions?|milliards?|million|billion|thousand|millón|millones|Millionen?|Milliarden?))?\s?(€|\$|£|EUR|USD)(?![a-zA-Z])/g, (_m, amt: string, big: string | undefined, sym: string) => {
    const k = currencyKind(sym)!;
    return unit(k, amt, big);
  });
  // k€ / k
  t = t.replace(/(\d+(?:[.,]\d+)?)\s?k(?=\s|$|[.,!?])/gi, (_m, a: string) => `${a} ${lang === 'fr' ? 'mille' : lang === 'es' ? 'mil' : lang === 'de' ? 'tausend' : 'thousand'}`);
  // Percent
  t = t.replace(/(\d+(?:[.,]\d+)?)\s?%/g, (_m, a: string) => `${a} ${PERCENT[lang]}`);
  // "/mois", "/month"
  t = t.replace(/\s?\/\s?([A-Za-zÀ-ÿ]+)/g, (m, w: string) => {
    const per = PER[lang][w] ?? PER[lang][w.toLowerCase()];
    return per ? ` ${per}` : m;
  });
  // Ordinal-free age shorthand in fr ("18 ans") is already readable. Strip emojis & symbols TTS might spell.
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
  t = t.replace(/[*_#"“”«»]/g, '').replace(/\s+/g, ' ').trim();
  void BIG;
  return t;
}

/**
 * Split display text into subtitle tokens. Number groups and their unit
 * ("1 000 000 €", "5 %") stay together as one token.
 */
export function displayTokens(text: string): string[] {
  const t = text
    .replace(SPACE_CHARS, NBSP)
    .replace(/(\d) (?=\d{3}\b)/g, `$1${NBSP}`)
    .replace(/(\d) ?([€%$£])/g, `$1${NBSP}$2`)
    .replace(/([€$£]) (\d)/g, `$1${NBSP}$2`)
    .replace(/ ([?!:;»])/g, `${NBSP}$1`)
    .replace(/(«) /g, `$1${NBSP}`);
  return t.split(/[ \t\n\r]+/).filter((w) => w.replace(NBSP, '').trim().length > 0).map((w) => w.replace(new RegExp(NBSP, 'g'), ' '));
}

export function wordCount(text: string): number {
  return displayTokens(text).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

export interface Clause {
  text: string;
  /** Terminating punctuation ("," "." "?" …) or '' at end of text. */
  punct: string;
}

/** Split at clause punctuation, never inside numbers like "2,4" or "1.5". */
export function splitClauses(text: string): Clause[] {
  const out: Clause[] = [];
  let buf = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    const prev = chars[i - 1] ?? '';
    const next = chars[i + 1] ?? '';
    const isPunct = /[,.;:!?…—]/.test(c);
    const inNumber = (c === ',' || c === '.') && /\d/.test(prev) && /\d/.test(next);
    if (isPunct && !inNumber) {
      let p = c;
      while (i + 1 < chars.length && /[,.;:!?…]/.test(chars[i + 1]!)) p += chars[++i]!;
      if (buf.trim()) out.push({ text: buf.trim(), punct: p === '—' ? ',' : p });
      else if (out.length) out[out.length - 1]!.punct += p;
      buf = '';
    } else {
      buf += c;
    }
  }
  if (buf.trim()) out.push({ text: buf.trim(), punct: '' });
  return out;
}

/** Sentence split used to synthesize narration in natural units. */
export function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let buf = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    buf += chars[i];
    const c = chars[i]!;
    if (/[.!?…]/.test(c)) {
      while (i + 1 < chars.length && /[.!?…»"”)]/.test(chars[i + 1]!)) buf += chars[++i];
      const next = chars[i + 1];
      const prevDigit = /\d/.test(chars[i - 1] ?? '');
      const nextDigit = /\d/.test(chars[i + 1] ?? '');
      if (c === '.' && prevDigit && nextDigit) continue;
      if (next === undefined || /\s/.test(next)) {
        if (buf.trim()) parts.push(buf.trim());
        buf = '';
      }
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

/* ------------------------------------------------------------------ */
/* Syllable estimation (used to weight word timing inside a phrase)    */
/* ------------------------------------------------------------------ */

function vowelGroups(word: string, lang: Language): number {
  const w = word.toLowerCase();
  const groups = w.match(/[aeiouyàâäáéèêëíîïóôöòúùûüœæ]+/g)?.length ?? 0;
  let n = groups;
  // French mute final -e / -es / -ent
  if (lang === 'fr' && /[^aeiouy](e|es|ent)$/.test(w) && n > 1) n -= 1;
  // English silent final e
  if (lang === 'en' && /[^aeiouy]e$/.test(w) && n > 1) n -= 1;
  return Math.max(groups > 0 ? 1 : 0, n);
}

/** Approximate spoken syllables of an integer (0 ≤ n < 1e12). */
export function numberSyllables(n: number, lang: Language): number {
  if (!Number.isFinite(n) || n < 0) return 2;
  n = Math.floor(n);
  if (n === 0) return 2;
  const unitSyll = lang === 'fr' ? [0, 1, 1, 1, 1, 1, 1, 1, 1, 1] : [0, 1, 1, 1, 1, 1, 1, 2, 1, 1];
  const below100 = (x: number): number => {
    if (x < 10) return unitSyll[x]!;
    if (x < 20) return 2;
    const tens = Math.floor(x / 10);
    const u = x % 10;
    const tensSyll = lang === 'fr' && (tens === 7 || tens === 9) ? 3 : 2;
    return tensSyll + (u ? unitSyll[u]! + (lang === 'fr' && u === 1 ? 1 : 0) : 0);
  };
  const below1000 = (x: number): number => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return (h ? (h > 1 ? unitSyll[h]! : 0) + (lang === 'en' ? 2 : 1) : 0) + (r ? below100(r) : 0);
  };
  let s = 0;
  const scales: Array<[number, number]> = [
    [1e9, lang === 'en' ? 2 : 3],
    [1e6, lang === 'en' ? 2 : 2],
    [1e3, lang === 'en' ? 2 : 1],
  ];
  let rest = n;
  for (const [v, syl] of scales) {
    const q = Math.floor(rest / v);
    if (q) {
      s += (q === 1 && v === 1e3 && lang !== 'en' ? 0 : below1000(q)) + syl;
      rest %= v;
    }
  }
  if (rest) s += below1000(rest);
  return Math.max(1, s);
}

/** Estimated syllables of a display token once spoken. */
export function tokenSyllables(token: string, lang: Language): number {
  const spoken = normalizeForSpeech(token, lang);
  let total = 0;
  for (const part of spoken.split(/\s+/)) {
    if (!part) continue;
    const num = /^\d+(?:[.,]\d+)?$/.test(part) ? part : null;
    if (num) {
      const [int, dec] = num.split(/[.,]/);
      total += numberSyllables(Number(int), lang) + (dec ? 2 + dec.length : 0);
    } else {
      total += vowelGroups(part, lang);
    }
  }
  return Math.max(1, total);
}

/** Pause weight (in syllable-equivalents) that a token's trailing punctuation implies. */
export function pauseWeight(token: string): number {
  if (/[.!?…]$/.test(token)) return 1.6;
  if (/[,;:—]$/.test(token)) return 0.8;
  return 0;
}
