import type { Currency } from '../../../text/format';

export type Archetype = 'windfall' | 'invest-monthly' | 'habit' | 'debt' | 'start-early';
export type Period = 'day' | 'week' | 'month' | 'year';

export interface ParsedTopic {
  archetype: Archetype | null;
  amount?: number;
  currency: Currency;
  period?: Period;
  age?: number;
  ages?: number[];
  years?: number;
  rate?: number;
  item?: 'coffee' | 'cigarettes' | 'subscription' | 'lunch' | 'phone' | null;
}

const MULTIPLIERS: Array<[RegExp, number]> = [
  [/^(billion|billions|milliards?|mil millones|milliarden?|md|bn)$/i, 1e9],
  [/^(million|millions|millón|millones|millionen?|mio|m)$/i, 1e6],
  [/^(thousand|thousands|mille|mil|tausend|k)$/i, 1e3],
];

function parseNumber(raw: string): number {
  let s = raw.trim();
  // "1 000 000", "1,000,000", "1.000.000" -> 1000000 ; "2,5" / "2.5" -> 2.5
  if (/^\d{1,3}([ .,  ]\d{3})+$/.test(s)) return Number(s.replace(/[ .,  ]/g, ''));
  s = s.replace(',', '.');
  return Number(s);
}

/** Extract money amounts: "€1 million", "1 million d'euros", "1M€", "100 000 €", "$500", "500 dollars". */
export function extractAmount(text: string): { amount: number; currency: Currency } | undefined {
  const t = text.replace(/[  ]/g, ' ');
  const curOf = (s: string): Currency => (/[$]|dollar|usd/i.test(s) ? 'USD' : /£|pound|livre|gbp|libra|pfund/i.test(s) ? 'GBP' : 'EUR');
  const num = String.raw`(\d{1,3}(?:[ .,]\d{3})+|\d+(?:[.,]\d+)?)`;
  const mult = String.raw`(?:\s?(billion|billions|milliards?|million|millions|millón|millones|millionen?|mio|thousand|mille|mil|tausend|k|m|bn)\b)?`;
  const prefix = new RegExp(String.raw`([€$£])\s?${num}${mult}`, 'i');
  const suffix = new RegExp(String.raw`${num}${mult}\s?(?:d['’]\s?|de\s)?(€|euros?|eur|\$|dollars?|usd|£|pounds?|livres?|gbp|libras?|pfund)`, 'i');
  let m = prefix.exec(t);
  if (m) {
    let v = parseNumber(m[2]!);
    const mul = m[3] ? MULTIPLIERS.find(([re]) => re.test(m![3]!))?.[1] ?? 1 : 1;
    v *= mul;
    return { amount: v, currency: curOf(m[1]!) };
  }
  m = suffix.exec(t);
  if (m) {
    let v = parseNumber(m[1]!);
    const mul = m[2] ? MULTIPLIERS.find(([re]) => re.test(m![2]!))?.[1] ?? 1 : 1;
    v *= mul;
    return { amount: v, currency: curOf(m[3]!) };
  }
  return undefined;
}

export function parseTopic(topic: string): ParsedTopic {
  const t = topic.toLowerCase().replace(/[  ]/g, ' ');
  const money = extractAmount(topic);
  const out: ParsedTopic = { archetype: null, currency: money?.currency ?? 'EUR', amount: money?.amount, item: null };

  const ageMatch = /(?:at age|aged|at|à|a los|mit|age of|âge de)\s?(\d{1,2})(?:\s?(?:ans|years? old|años|jahren|yo))?\b/i.exec(t) ?? /(\d{1,2})\s?(?:ans|years? old|años|jahre)/i.exec(t);
  if (ageMatch) {
    const a = Number(ageMatch[1]);
    if (a >= 10 && a <= 80) out.age = a;
  }
  const ages = [...t.matchAll(/(?:at|à|a los|mit)\s?(\d{2})\b/g)].map((x) => Number(x[1])).filter((a) => a >= 14 && a <= 70);
  if (ages.length >= 2) out.ages = ages.slice(0, 2);
  else if (/\bvs\.?\b|versus|\bor\b|\bou\b|\boder\b|\bo\b/.test(t)) {
    const nums = [...t.replace(/[€$£]\s?\d+|\d+\s?(?:€|\$|£|euros?|dollars?)/g, '').matchAll(/\b(\d{2})\b/g)].map((x) => Number(x[1])).filter((a) => a >= 14 && a <= 70);
    if (nums.length >= 2) out.ages = nums.slice(0, 2);
  }

  const yearsMatch = /(?:for|pendant|during|durant|over|sur|en|durante|für)\s?(\d{1,2})\s?(?:years|ans|années|años|jahre)/i.exec(t);
  if (yearsMatch) out.years = Number(yearsMatch[1]);
  const rateMatch = /(\d{1,2}(?:[.,]\d)?)\s?%/.exec(t);
  if (rateMatch) out.rate = Number(rateMatch[1]!.replace(',', '.')) / 100;

  if (/(per|a|each|every|by|par|chaque|tous les|al|cada|pro|jeden|im)\s?(day|jour|día|tag)|daily|quotidien|diario|täglich/.test(t)) out.period = 'day';
  else if (/(per|a|each|every|par|chaque|al|cada|pro)\s?(week|semaine|semana|woche)|weekly|hebdo/.test(t)) out.period = 'week';
  else if (/(per|a|each|every|par|chaque|tous les|al|cada|pro|jeden|im)\s?(month|mois|mes|monat)|monthly|mensuel|mensual|monatlich|\/\s?(mois|month|mo|mes|monat)/.test(t)) out.period = 'month';
  else if (/(per|a|each|every|par|chaque|al|cada|pro)\s?(year|an|année|año|jahr)|yearly|annually|annuel/.test(t)) out.period = 'year';

  if (/coffee|café|cafe|kaffee|latte|starbucks/.test(t)) out.item = 'coffee';
  else if (/cigarette|clope|tabac|cigarrillo|zigarette|smok|fumer/.test(t)) out.item = 'cigarettes';
  else if (/netflix|spotify|subscription|abonnement|suscripci|abo\b/.test(t)) out.item = 'subscription';
  else if (/lunch|déjeuner|dejeuner|restaurant|resto|uber ?eats|deliveroo|takeaway/.test(t)) out.item = 'lunch';

  const has = (re: RegExp) => re.test(t);
  if (has(/debt|dette|crédit renouvelable|credit card|carte de crédit|loan|prêt|emprunt|deuda|tarjeta de crédito|schulden|kredit|minimum payment/)) out.archetype = 'debt';
  else if (
    (out.ages && out.ages.length >= 2) ||
    has(/start(ing)? (to )?invest(ing)? (at|early)|commencer à investir (à|tôt)|vs\.? \d{2}|versus|empezar a invertir|früh(er)? anfangen/)
  )
    out.archetype = 'start-early';
  else if (out.item || has(/habit|habitude|hábito|gewohnheit|stop(ped)? buying|arrêt(ais|er) d'acheter|dejaras de comprar/)) out.archetype = 'habit';
  else if (out.period && money && has(/invest|placer|plaçais|placé|épargn|save|saving|ahorr|invert|spar|anleg|mettais de côté|put aside|set aside/)) out.archetype = 'invest-monthly';
  else if (
    money &&
    has(/receiv|got|get|won|win|inherit|lottery|lotto|jackpot|reçu|recevais|recevoir|gagn|hérit|loto|recibier|ganar|herenc|lotería|bekomm|gewinn|erb|lotto|found|trouv|gift|donn|offert/)
  )
    out.archetype = 'windfall';
  else if (money && out.period) out.archetype = 'invest-monthly';
  else if (money && !out.period) out.archetype = 'windfall';
  return out;
}
