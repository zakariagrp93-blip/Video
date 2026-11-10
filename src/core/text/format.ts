import type { Language } from '../../shared/constants';

export type Currency = 'EUR' | 'USD' | 'GBP';

const SYMBOL: Record<Currency, string> = { EUR: '€', USD: '$', GBP: '£' };
const WORDS: Record<Language, Record<Currency, [string, string]>> = {
  fr: { EUR: ['euro', 'euros'], USD: ['dollar', 'dollars'], GBP: ['livre', 'livres'] },
  en: { EUR: ['euro', 'euros'], USD: ['dollar', 'dollars'], GBP: ['pound', 'pounds'] },
  es: { EUR: ['euro', 'euros'], USD: ['dólar', 'dólares'], GBP: ['libra', 'libras'] },
  de: { EUR: ['Euro', 'Euro'], USD: ['Dollar', 'Dollar'], GBP: ['Pfund', 'Pfund'] },
};

/** Group thousands: fr/es/de "1 000 000", en "1,000,000". */
export function formatInt(v: number, lang: Language): string {
  const s = Math.round(Math.abs(v)).toString();
  const sep = lang === 'en' ? ',' : lang === 'de' ? '.' : ' ';
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return (v < 0 ? '-' : '') + (lang === 'es' && s.length <= 4 ? s : grouped);
}

export function formatDecimal(v: number, lang: Language, digits = 1): string {
  const fixed = v.toFixed(digits).replace(/\.0+$/, '');
  return lang === 'en' ? fixed : fixed.replace('.', ',');
}

/**
 * Money for narration and subtitles. Large amounts use words
 * ("2,4 millions d’euros", "€2.4 million"), smaller ones digits ("3 750 €", "$3,750").
 */
export function formatMoney(v: number, cur: Currency, lang: Language): string {
  const a = Math.abs(v);
  const sym = SYMBOL[cur];
  if (a >= 1e6) {
    const billions = a >= 1e9;
    const x = billions ? a / 1e9 : a / 1e6;
    const num = formatDecimal(Math.round(x * 10) / 10, lang);
    const plural = x >= 2;
    if (lang === 'fr') {
      const w = billions ? (plural ? 'milliards' : 'milliard') : plural ? 'millions' : 'million';
      const unit = WORDS.fr[cur][1];
      return `${num} ${w} ${/^[aeiou]/i.test(unit) ? 'd’' : 'de '}${unit}`;
    }
    if (lang === 'es') {
      const w = billions ? 'mil millones' : plural ? 'millones' : 'millón';
      return `${num} ${w} de ${WORDS.es[cur][1]}`;
    }
    if (lang === 'de') return `${num} ${billions ? (plural ? 'Milliarden' : 'Milliarde') : plural ? 'Millionen' : 'Million'} ${WORDS.de[cur][1]}`;
    return `${sym}${num} ${billions ? 'billion' : 'million'}`;
  }
  const n = formatInt(v, lang);
  return lang === 'en' ? `${sym}${n}` : `${n} ${sym}`;
}

export function formatPercent(r: number, lang: Language): string {
  const p = formatDecimal(r * 100, lang);
  return lang === 'en' ? `${p}%` : `${p} %`;
}

export function currencySuffix(cur: Currency): string {
  return SYMBOL[cur];
}

export function currencyWord(cur: Currency, lang: Language, plural = true): string {
  return WORDS[lang][cur][plural ? 1 : 0];
}
