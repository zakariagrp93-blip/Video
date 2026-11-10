import type { StorytellingStyle } from '../../../../shared/constants';
import type { Claim, Counter } from '../../../../shared/schemas';
import { futureValueLump, futureValueMonthly, payoffFixed, payoffMinimum, roundFriendly } from '../../../finance/math';
import { formatDecimal, formatMoney, formatPercent, type Currency } from '../../../text/format';
import { P, S, beat, d, type Beat } from './direction';
import type { ParsedTopic } from './topicParser';

export type OfflineLanguage = 'fr' | 'en';

export interface ArchetypeOutput {
  title: string;
  beats: Beat[];
  assumptions: string[];
  claims: Claim[];
  hashtags: string[];
}

interface Ctx {
  lang: OfflineLanguage;
  cur: Currency;
  style: StorytellingStyle;
  /** Pick the French or English text. */
  t: (fr: string, en: string) => string;
  m: (v: number) => string;
  pct: (r: number) => string;
  counter: (to: number, from?: number, suffix?: string) => Counter;
}

function makeCtx(lang: OfflineLanguage, cur: Currency, style: StorytellingStyle): Ctx {
  const sym = cur === 'EUR' ? '€' : cur === 'USD' ? '$' : '£';
  return {
    lang,
    cur,
    style,
    t: (fr, en) => (lang === 'fr' ? fr : en),
    m: (v) => formatMoney(roundFriendly(v), cur, lang),
    pct: (r) => formatPercent(r, lang),
    counter: (to, from = 0, suffix = '') =>
      lang === 'en'
        ? { from, to: roundFriendly(to), prefix: sym, suffix, decimals: 0 }
        : { from, to: roundFriendly(to), prefix: '', suffix: ` ${sym}${suffix}`, decimals: 0 },
  };
}

/** Words of a formatted amount, for subtitle emphasis. */
function words(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* 1. Windfall: "What if you received €1 million at 18?"               */
/* ------------------------------------------------------------------ */
function windfall(p: ParsedTopic, c: Ctx): ArchetypeOutput {
  const { t, m, pct } = c;
  const A = p.amount ?? 1_000_000;
  const age = p.age;
  const r = p.rate ?? 0.05;
  const N = p.years ?? 20;
  const keep = roundFriendly(A * 0.1);
  const inv = A - keep;
  const annual = inv * r;
  const monthly = annual / 12;
  const fv = futureValueLump(inv, r, N);
  const big = A >= 200_000;
  const Am = m(A);

  const hook: Record<StorytellingStyle, string> = {
    hypothetical: age
      ? t(`Et si, à ${age} ans, tu te réveillais avec ${Am} sur ton compte ?`, `What if you woke up at ${age} with ${Am} in your bank account?`)
      : t(`Et si demain, tu te réveillais avec ${Am} sur ton compte ?`, `What if you woke up tomorrow with ${Am} in your bank account?`),
    storytelling: age
      ? t(`${age} ans. Un matin, Nummo ouvre son appli bancaire… et voit ${Am}.`, `Age ${age}. One morning, Nummo opens the banking app… and sees ${Am}.`)
      : t(`Un matin, Nummo ouvre son appli bancaire… et voit ${Am}.`, `One morning, Nummo opens the banking app… and sees ${Am}.`),
    educational: t(`${Am}${age ? ` à ${age} ans` : ''} : voici comment le transformer en revenu à vie.`, `${Am}${age ? ` at ${age}` : ''}: here is how it could turn into income for life.`),
    facts: t(`${Am}${age ? ` à ${age} ans` : ''}. Faisons les vrais calculs.`, `${Am}${age ? ` at ${age}` : ''}. Let's run the real numbers.`),
    unexpected: t(`Recevoir ${Am}${age ? ` à ${age} ans` : ''} peut être le début… de la ruine.`, `Getting ${Am}${age ? ` at ${age}` : ''} can be the start… of going broke.`),
  };

  const beats: Beat[] = [
    beat(
      hook[c.style],
      d({ pose: 'holding-phone', expr: 'shocked', bg: 'spotlight', cam: 'push-in', tr: 'cut', overlay: { text: Am, style: 'number', counter: c.counter(A) }, sfx: [S('cash', 'middle')] }),
      [...words(Am), ...(age ? [String(age)] : [])],
    ),
    beat(
      big
        ? t('Premier réflexe : tout dépenser. Une voiture de sport, un grand appart, des vacances au bout du monde.', 'First instinct: spend it all. A sports car, a big apartment, trips around the world.')
        : t('Premier réflexe : se faire plaisir. Une nouvelle voiture, du shopping, un beau voyage.', 'First instinct: treat yourself. A new car, some shopping, a great trip.'),
      d({
        pose: 'celebrating',
        expr: 'excited',
        pos: 'left',
        bg: 'floor',
        cam: 'zoom-out',
        fx: 'money-rain',
        props: [P(big ? 'sports-car' : 'car', 'slide-right', 'right', { delay: 0.1 }), P(big ? 'mansion' : 'shopping-bag', 'pop', 'top-right', { delay: 0.4 }), P('plane', 'slide-left', 'top-left', { delay: 0.65 })],
        sfx: [S('whoosh', 'start')],
      }),
      [t('tout dépenser', 'spend it all')],
    ),
    beat(
      t('Le problème ? Tout ça coûte aussi chaque année : entretien, assurances, taxes.', 'The problem? All of that also costs money every year: maintenance, insurance, taxes.'),
      d({ pose: 'thinking', expr: 'worried', pos: 'left', bg: 'vignette', tr: 'slide-left', props: [P('receipt', 'fall', 'right', { count: 3 })], overlay: { text: t('Coûts cachés', 'Hidden costs'), style: 'warning' }, sfx: [S('typing', 'middle')] }),
      [],
      [t('entretien,', 'maintenance,'), t('assurances,', 'insurance,'), t('taxes.', 'taxes.')],
    ),
    beat(
      t('C’est comme ça qu’une fortune fond : pas d’un coup, mais une dépense après l’autre.', 'That is how a fortune melts away: not all at once, but one purchase at a time.'),
      d({ pose: 'sad', expr: 'sad', bg: 'vignette', cam: 'zoom-in', fx: 'smoke', chart: { kind: 'line', trend: 'down', values: [100, 84, 70, 52, 41, 27, 15, 6] }, sfx: [S('fail', 'end')] }),
      [],
      [t('fond', 'melts'), t('dépense', 'purchase')],
    ),
    beat(
      t(`Rejouons la scène. Tu gardes ${m(keep)} pour te faire plaisir…`, `Let's replay it. You keep ${m(keep)} to enjoy…`),
      d({ pose: 'holding-money', expr: 'smug', pos: 'left', bg: 'spotlight', tr: 'wipe', props: [P('gift', 'pop', 'right', { delay: 0.3 })], overlay: { text: m(keep), style: 'number' }, sfx: [S('swoosh', 'start')] }),
      words(m(keep)),
    ),
    beat(
      t(`…et tu places les ${m(inv)} restants.`, `…and you invest the remaining ${m(inv)}.`),
      d({ pose: 'pointing', expr: 'determined', pos: 'left', bg: 'spotlight', props: [P('bank', 'rise', 'right'), P('money-stack', 'slide-right', 'center', { delay: 0.35 })], sfx: [S('coin', 'middle')] }),
      [t('places', 'invest'), ...words(m(inv))],
    ),
    beat(
      t(`Hypothèse : un rendement moyen de ${pct(r)} par an. Ce n’est pas garanti : les marchés montent et descendent.`, `Assumption: an average return of ${pct(r)} a year. It is not guaranteed: markets go up and down.`),
      d({ pose: 'thinking', expr: 'thinking', pos: 'right', facing: 'left', bg: 'grid', tr: 'slide-up', chart: { kind: 'line', trend: 'volatile', values: [100, 112, 104, 121, 113, 132, 125, 141] }, overlay: { text: t(`${pct(r)} / an`, `${pct(r)} / year`), style: 'label' }, sfx: [S('tick', 'start')] }),
      [pct(r), t('Hypothèse', 'Assumption:')],
      [t('garanti', 'guaranteed:')],
    ),
    beat(
      t(`${pct(r)} de ${m(inv)}, c’est ${m(annual)} par an. Sans travailler.`, `${pct(r)} of ${m(inv)} is ${m(annual)} a year. Without working.`),
      d({ pose: 'surprised', expr: 'surprised', bg: 'spotlight', cam: 'zoom-in', fx: 'coin-burst', props: [P('coin-stack', 'grow', 'bottom', { delay: 0.2 })], overlay: { text: m(annual), style: 'number', counter: c.counter(annual, 0, t(' / an', ' / yr')) }, sfx: [S('cash', 'middle')] }),
      [...words(m(annual)), t('travailler.', 'working.')],
    ),
    beat(
      t(`Soit environ ${m(monthly)} par mois, rien qu’avec les intérêts.`, `That is about ${m(monthly)} a month, from interest alone.`),
      d({ pose: 'happy', expr: 'happy', pos: 'left', bg: 'floor', tr: 'slide-left', props: [P('calendar', 'pop', 'right'), P('coin', 'float', 'top-right', { count: 3, delay: 0.3 })], overlay: { text: t(`${m(monthly)} / mois`, `${m(monthly)} / month`), style: 'number' }, sfx: [S('coin', 'middle')] }),
      [...words(m(monthly)), t('intérêts.', 'interest')],
    ),
    beat(
      t(`Et si tu ne touches à rien pendant ${N} ans ? Les intérêts composés font grossir le capital… jusqu’à environ ${m(fv)}.`, `And if you leave it untouched for ${N} years? Compound interest grows the pile… to about ${m(fv)}.`),
      d({ pose: 'explaining', expr: 'excited', pos: 'left', bg: 'grid', cam: 'zoom-in', tr: 'zoom-through', chart: { kind: 'bar', trend: 'up', values: Array.from({ length: 8 }, (_, i) => Math.round(futureValueLump(inv, r, (N * (i + 1)) / 8))) }, overlay: { text: m(fv), style: 'number', counter: c.counter(fv, roundFriendly(inv)) }, sfx: [S('riser', 'start'), S('ding', 'end')] }),
      [...words(m(fv)), t('composés', 'Compound')],
    ),
    beat(
      age ? t(`À ${age + N} ans, ton argent travaillerait plus que toi.`, `By ${age + N}, your money would be working harder than you.`) : t(`Dans ${N} ans, ton argent travaillerait plus que toi.`, `In ${N} years, your money would be working harder than you.`),
      d({ pose: 'sitting', expr: 'smug', bg: 'stars', fx: 'sparkles', props: [P('coffee', 'float', 'right'), P('clock', 'pop', 'top-left', { delay: 0.4 })], sfx: [S('ding', 'middle')] }),
      [t('travaillerait', 'working'), ...(age ? [String(age + N)] : [])],
    ),
    beat(
      t('Mais attention : l’inflation grignote ce pouvoir d’achat, et les impôts prennent leur part.', 'But careful: inflation eats away at that buying power, and taxes take their share.'),
      d({ pose: 'shocked', expr: 'worried', bg: 'vignette', cam: 'shake', tr: 'cut', fx: 'impact', props: [P('percent-badge', 'shake', 'right'), P('receipt', 'fall', 'top-left', { delay: 0.5 })], sfx: [S('impact', 'start')] }),
      [],
      [t('l’inflation', 'inflation'), t('impôts', 'taxes')],
    ),
  ];
  const final: Record<StorytellingStyle, string> = {
    hypothetical: t('Recevoir un million, c’est de la chance. Le garder, c’est une décision.', 'Getting a million is luck. Keeping it is a decision.'),
    storytelling: t('Nummo a compris une chose : la chance donne l’argent, la discipline le garde.', 'Nummo learned one thing: luck gives you money, discipline keeps it.'),
    educational: t('Retiens ça : ce n’est pas le montant qui compte, c’est ce que tu en fais.', 'Remember this: it is not the amount that matters, it is what you do with it.'),
    facts: t('Le chiffre de départ impressionne. Le chiffre d’arrivée dépend de toi.', 'The starting number is impressive. The final number depends on you.'),
    unexpected: t('La vraie surprise ? Le plus dur n’est pas de le gagner. C’est de le garder.', 'The real twist? The hard part is not getting it. It is keeping it.'),
  };
  if (A < 900_000 || A > 1_100_000) {
    final.hypothetical = t('Recevoir cet argent, c’est de la chance. Le garder, c’est une décision.', 'Getting that money is luck. Keeping it is a decision.');
  }
  beats.push(beat(final[c.style], d({ pose: 'idle', expr: 'determined', bg: 'spotlight', cam: 'push-in', props: [P('trophy', 'rise', 'top')], sfx: [S('ding', 'start')] }), [t('chance.', 'luck.'), t('décision.', 'decision.'), t('discipline', 'discipline')]));

  return {
    title: age ? t(`Et si tu recevais ${Am} à ${age} ans ?`, `What if you received ${Am} at ${age}?`) : t(`Et si tu recevais ${Am} ?`, `What if you received ${Am}?`),
    beats,
    assumptions: [
      t(`Rendement moyen hypothétique de ${pct(r)} par an, non garanti.`, `Hypothetical average return of ${pct(r)} per year, not guaranteed.`),
      t(`${m(keep)} dépensés, ${m(inv)} investis, aucun retrait pendant ${N} ans.`, `${m(keep)} spent, ${m(inv)} invested, no withdrawals for ${N} years.`),
      t('Inflation et impôts non déduits des montants affichés.', 'Inflation and taxes are not deducted from the amounts shown.'),
    ],
    claims: [
      { text: `${pct(r)} × ${m(inv)} ≈ ${m(annual)}`, kind: 'calculation' },
      { text: `${m(inv)} × (1 + ${pct(r)})^${N} ≈ ${m(fv)}`, kind: 'calculation' },
      { text: t(`Rendement de ${pct(r)} par an`, `${pct(r)} yearly return`), kind: 'hypothesis' },
    ],
    hashtags: t('#finance #argent #investissement #interetscomposes', '#finance #money #investing #compoundinterest').split(' '),
  };
}

/* ------------------------------------------------------------------ */
/* 2. Monthly investing: "What if you invested €100 a month?"           */
/* ------------------------------------------------------------------ */
function investMonthly(p: ParsedTopic, c: Ctx): ArchetypeOutput {
  const { t, m, pct } = c;
  let P0 = p.amount ?? 100;
  if (p.period === 'day') P0 = P0 * 30;
  else if (p.period === 'week') P0 = (P0 * 52) / 12;
  else if (p.period === 'year') P0 = P0 / 12;
  const N = p.years ?? (p.age ? Math.max(10, Math.min(45, 65 - p.age)) : 30);
  const r = p.rate ?? 0.06;
  const y1 = Math.max(5, Math.round(N / 3));
  const y2 = Math.max(y1 + 3, Math.round((2 * N) / 3));
  const fv1 = futureValueMonthly(P0, r, y1);
  const fv2 = futureValueMonthly(P0, r, y2);
  const fvN = futureValueMonthly(P0, r, N);
  const paid = P0 * 12 * N;
  const gains = fvN - paid;
  const Pm = m(P0);
  const hook: Record<StorytellingStyle, string> = {
    hypothetical: t(`${Pm} par mois. Ça paraît peu… mais regarde ce que ça devient en ${N} ans.`, `${Pm} a month. Sounds small… but watch what it becomes in ${N} years.`),
    storytelling: t(`Chaque mois, Nummo met ${Pm} de côté. Ses amis rigolent. Pas pour longtemps.`, `Every month, Nummo sets aside ${Pm}. Nummo's friends laugh. Not for long.`),
    educational: t(`Voici pourquoi ${Pm} par mois peut valoir une fortune.`, `Here is why ${Pm} a month can be worth a fortune.`),
    facts: t(`${Pm} par mois pendant ${N} ans. Les chiffres sont surprenants.`, `${Pm} a month for ${N} years. The numbers are surprising.`),
    unexpected: t(`La somme la plus rentable de ta vie ? Peut-être ${Pm} par mois.`, `The most profitable amount of your life? Maybe ${Pm} a month.`),
  };
  const beats: Beat[] = [
    beat(hook[c.style], d({ pose: 'holding-money', expr: 'smug', bg: 'spotlight', cam: 'push-in', tr: 'cut', overlay: { text: t(`${Pm} / mois`, `${Pm} / month`), style: 'number' }, sfx: [S('coin', 'middle')] }), [...words(Pm), String(N)]),
    beat(t(`Le principe est simple : chaque mois, tu mets ${Pm} de côté. Pas plus.`, `The rule is simple: every month, you put aside ${Pm}. No more.`), d({ pose: 'explaining', expr: 'neutral', pos: 'left', bg: 'floor', props: [P('piggy-bank', 'pop', 'right'), P('coin', 'fall', 'top-right', { count: 3, delay: 0.3 })], sfx: [S('coin', 'middle')] }), words(Pm)),
    beat(t(`Après un an, tu as versé ${m(P0 * 12)}. Rien d’extraordinaire.`, `After one year, you have put in ${m(P0 * 12)}. Nothing special.`), d({ pose: 'idle', expr: 'neutral', pos: 'left', bg: 'floor', tr: 'slide-left', props: [P('calendar', 'pop', 'right')], overlay: { text: m(P0 * 12), style: 'number', counter: c.counter(P0 * 12) } }), words(m(P0 * 12))),
    beat(t('Mais au lieu de laisser cet argent dormir, tu l’investis.', 'But instead of letting that money sleep, you invest it.'), d({ pose: 'pointing', expr: 'determined', pos: 'left', bg: 'spotlight', props: [P('chart-up', 'rise', 'right')], sfx: [S('swoosh', 'start')] }), [t('investis.', 'invest')], [t('dormir,', 'sleep,')]),
    beat(t(`Hypothèse : ${pct(r)} par an en moyenne. Ce n’est pas garanti, et certaines années seront négatives.`, `Assumption: ${pct(r)} a year on average. It is not guaranteed, and some years will be negative.`), d({ pose: 'thinking', expr: 'thinking', pos: 'right', facing: 'left', bg: 'grid', tr: 'slide-up', chart: { kind: 'line', trend: 'volatile', values: [100, 108, 99, 117, 111, 126, 120, 138] }, overlay: { text: t(`${pct(r)} / an`, `${pct(r)} / year`), style: 'label' }, sfx: [S('tick', 'start')] }), [pct(r)], [t('négatives.', 'negative.')]),
    beat(t('Les gains de chaque année produisent à leur tour des gains. C’est ça, les intérêts composés.', 'Each year’s gains start earning gains of their own. That is compound interest.'), d({ pose: 'explaining', expr: 'excited', bg: 'grid', cam: 'zoom-in', fx: 'sparkles', props: [P('coin-stack', 'grow', 'bottom')], sfx: [S('ding', 'end')] }), [t('composés.', 'compound')]),
    beat(t(`Après ${y1} ans : environ ${m(fv1)}.`, `After ${y1} years: about ${m(fv1)}.`), d({ pose: 'happy', expr: 'happy', pos: 'left', bg: 'floor', tr: 'slide-left', props: [P('money-stack', 'pop', 'right')], overlay: { text: m(fv1), style: 'number', counter: c.counter(fv1) }, sfx: [S('coin', 'start')] }), words(m(fv1))),
    beat(t(`Après ${y2} ans : environ ${m(fv2)}.`, `After ${y2} years: about ${m(fv2)}.`), d({ pose: 'surprised', expr: 'surprised', pos: 'left', bg: 'floor', tr: 'slide-left', props: [P('money-bag', 'pop', 'right')], overlay: { text: m(fv2), style: 'number', counter: c.counter(fv2, roundFriendly(fv1)) }, sfx: [S('cash', 'start')] }), words(m(fv2))),
    beat(t(`Et après ${N} ans : environ ${m(fvN)}.`, `And after ${N} years: about ${m(fvN)}.`), d({ pose: 'celebrating', expr: 'excited', bg: 'spotlight', cam: 'zoom-in', tr: 'zoom-through', fx: 'money-rain', chart: { kind: 'bar', trend: 'up', values: Array.from({ length: 8 }, (_, i) => Math.round(futureValueMonthly(P0, r, (N * (i + 1)) / 8))) }, overlay: { text: m(fvN), style: 'number', counter: c.counter(fvN, roundFriendly(fv2)) }, sfx: [S('riser', 'start'), S('cash', 'end')] }), words(m(fvN))),
    beat(t(`Toi, tu n’as versé que ${m(paid)}. Le reste, environ ${m(gains)}, vient des intérêts.`, `You only put in ${m(paid)}. The rest, about ${m(gains)}, came from interest.`), d({ pose: 'pointing', expr: 'smug', pos: 'left', bg: 'grid', props: [P('piggy-bank', 'none', 'right'), P('chart-up', 'pop', 'top-right', { delay: 0.45 })], sfx: [S('pop', 'middle')] }), [...words(m(paid)), ...words(m(gains)), t('intérêts.', 'interest.')]),
  ];
  const final: Record<StorytellingStyle, string> = {
    hypothetical: t('Le secret n’est pas le montant. C’est le temps.', 'The secret is not the amount. It is time.'),
    storytelling: t('Ses amis ne rigolent plus. Nummo, lui, a juste commencé tôt.', 'The friends stopped laughing. Nummo simply started early.'),
    educational: t('Retiens ça : la régularité bat le montant.', 'Remember: consistency beats size.'),
    facts: t('Ce n’est pas de la magie. C’est des mathématiques et de la patience.', 'It is not magic. It is math and patience.'),
    unexpected: t('Le plus gros contributeur à ta fortune, ce n’est pas toi. C’est le temps.', 'The biggest contributor to your wealth is not you. It is time.'),
  };
  beats.push(beat(final[c.style], d({ pose: 'idle', expr: 'determined', bg: 'spotlight', cam: 'push-in', props: [P('hourglass', 'rise', 'top')], sfx: [S('ding', 'start')] }), [t('temps.', 'time.'), t('régularité', 'consistency'), t('patience.', 'patience.')]));
  return {
    title: t(`Et si tu investissais ${Pm} par mois ?`, `What if you invested ${Pm} a month?`),
    beats,
    assumptions: [t(`Rendement hypothétique de ${pct(r)} par an, capitalisé mensuellement, non garanti.`, `Hypothetical ${pct(r)} yearly return, compounded monthly, not guaranteed.`), t('Frais, impôts et inflation non inclus.', 'Fees, taxes and inflation not included.')],
    claims: [
      { text: `FV(${Pm}/m, ${pct(r)}, ${N}) ≈ ${m(fvN)}`, kind: 'calculation' },
      { text: `${Pm} × 12 × ${N} = ${m(paid)}`, kind: 'calculation' },
      { text: t(`Rendement de ${pct(r)} par an`, `${pct(r)} yearly return`), kind: 'hypothesis' },
    ],
    hashtags: t('#finance #epargne #investissement #interetscomposes', '#finance #saving #investing #compoundinterest').split(' '),
  };
}

/* ------------------------------------------------------------------ */
/* 3. Habit cost: "What if you stopped buying coffee every day?"        */
/* ------------------------------------------------------------------ */
function habit(p: ParsedTopic, c: Ctx): ArchetypeOutput {
  const { t, m, pct } = c;
  const itemName = {
    coffee: t('ton café', 'your coffee'),
    cigarettes: t('ton paquet de cigarettes', 'your pack of cigarettes'),
    subscription: t('ton abonnement', 'your subscription'),
    lunch: t('ton déjeuner à emporter', 'your takeaway lunch'),
    phone: t('ton forfait', 'your phone plan'),
  } as const;
  const item = p.item ?? 'coffee';
  const name = itemName[item];
  const defaultDaily: Record<string, number> = { coffee: 3, cigarettes: 11, lunch: 12, subscription: 15 / 30, phone: 20 / 30 };
  let daily = p.amount ?? defaultDaily[item] ?? 3;
  if (p.period === 'month') daily /= 30;
  if (p.period === 'week') daily /= 7;
  if (p.period === 'year') daily /= 365;
  const assumedPrice = p.amount === undefined;
  const monthly = daily * 30.4;
  const yearly = daily * 365;
  const r = p.rate ?? 0.05;
  const fv10 = futureValueMonthly(monthly, r, 10);
  const fv30 = futureValueMonthly(monthly, r, 30);
  const prop = item === 'coffee' ? 'coffee' : item === 'subscription' ? 'phone' : item === 'lunch' ? 'shopping-bag' : 'receipt';
  const dm = m(daily);
  const beats: Beat[] = [
    beat(
      c.style === 'unexpected'
        ? t(`Ce petit plaisir quotidien pourrait te coûter une voiture.`, `That small daily treat could cost you a car.`)
        : t(`${name.charAt(0).toUpperCase() + name.slice(1)} te coûte bien plus que ${dm}.`, `${name.charAt(0).toUpperCase() + name.slice(1)} costs you a lot more than ${dm}.`),
      d({ pose: 'surprised', expr: 'surprised', bg: 'spotlight', cam: 'push-in', tr: 'cut', props: [P(prop, 'pop', 'hand')], sfx: [S('pop', 'start')] }),
      words(dm),
    ),
    beat(assumedPrice ? t(`Disons ${dm} par jour. Faisons le calcul.`, `Let's say ${dm} a day. Let's do the math.`) : t(`${dm} par jour. Faisons le calcul.`, `${dm} a day. Let's do the math.`), d({ pose: 'explaining', expr: 'neutral', pos: 'left', bg: 'grid', props: [P('calendar', 'pop', 'right')], overlay: { text: t(`${dm} / jour`, `${dm} / day`), style: 'number' }, sfx: [S('typing', 'middle')] }), [...words(dm), t('Disons', 'say')]),
    beat(t(`Ça fait environ ${m(monthly)} par mois…`, `That is about ${m(monthly)} a month…`), d({ pose: 'pointing', expr: 'neutral', pos: 'left', bg: 'grid', tr: 'slide-left', props: [P('coin', 'fall', 'right', { count: 4 })], overlay: { text: m(monthly), style: 'number', counter: c.counter(monthly) }, sfx: [S('coin', 'start')] }), words(m(monthly))),
    beat(t(`…et ${m(yearly)} par an.`, `…and ${m(yearly)} a year.`), d({ pose: 'surprised', expr: 'worried', pos: 'left', bg: 'grid', tr: 'slide-left', props: [P('money-stack', 'pop', 'right')], overlay: { text: m(yearly), style: 'number', counter: c.counter(yearly, roundFriendly(monthly)) }, sfx: [S('cash', 'start')] }), words(m(yearly))),
    beat(t(`Sur dix ans, ça fait ${m(yearly * 10)}.`, `Over ten years, that is ${m(yearly * 10)}.`), d({ pose: 'shocked', expr: 'shocked', bg: 'vignette', cam: 'zoom-in', fx: 'impact', props: [P('car', 'slide-right', 'bottom', { delay: 0.3 })], overlay: { text: m(yearly * 10), style: 'number', counter: c.counter(yearly * 10, roundFriendly(yearly)) }, sfx: [S('impact', 'start')] }), words(m(yearly * 10)), [t('dix', 'ten')]),
    beat(t('Maintenant, imagine que tu places cet argent chaque mois au lieu de le dépenser.', 'Now imagine investing that money every month instead of spending it.'), d({ pose: 'thinking', expr: 'thinking', pos: 'right', facing: 'left', bg: 'spotlight', tr: 'wipe', props: [P('piggy-bank', 'pop', 'left')], sfx: [S('swoosh', 'start')] }), [t('places', 'investing')]),
    beat(t(`Hypothèse : ${pct(r)} par an en moyenne. Ce n’est pas garanti.`, `Assumption: ${pct(r)} a year on average. It is not guaranteed.`), d({ pose: 'explaining', expr: 'neutral', pos: 'right', facing: 'left', bg: 'grid', chart: { kind: 'line', trend: 'volatile', values: [100, 106, 101, 113, 109, 121, 117, 130] }, overlay: { text: t(`${pct(r)} / an`, `${pct(r)} / year`), style: 'label' }, sfx: [S('tick', 'start')] }), [pct(r)], [t('garanti.', 'guaranteed.')]),
    beat(t(`En dix ans, tu aurais environ ${m(fv10)}.`, `In ten years, you would have about ${m(fv10)}.`), d({ pose: 'happy', expr: 'happy', pos: 'left', bg: 'floor', props: [P('money-bag', 'grow', 'right')], overlay: { text: m(fv10), style: 'number', counter: c.counter(fv10) }, sfx: [S('coin', 'middle')] }), words(m(fv10))),
    beat(t(`En trente ans : environ ${m(fv30)}.`, `In thirty years: about ${m(fv30)}.`), d({ pose: 'celebrating', expr: 'excited', bg: 'spotlight', cam: 'zoom-in', tr: 'zoom-through', fx: 'money-rain', chart: { kind: 'bar', trend: 'up', values: Array.from({ length: 8 }, (_, i) => Math.round(futureValueMonthly(monthly, r, (30 * (i + 1)) / 8))) }, overlay: { text: m(fv30), style: 'number', counter: c.counter(fv30, roundFriendly(fv10)) }, sfx: [S('riser', 'start'), S('cash', 'end')] }), words(m(fv30))),
    beat(t('Est-ce qu’il faut tout arrêter ? Non. Il faut juste savoir ce que ça coûte vraiment.', 'Should you quit everything? No. You just need to know what it really costs.'), d({ pose: 'explaining', expr: 'smug', bg: 'floor', props: [P(prop, 'float', 'right')], sfx: [S('pop', 'start')] }), [t('vraiment.', 'really')], [t('Non.', 'No.')]),
  ];
  beats.push(beat(t('Ce n’est pas la dépense qui coûte cher. C’est l’habitude.', 'It is not the purchase that is expensive. It is the habit.'), d({ pose: 'idle', expr: 'determined', bg: 'spotlight', cam: 'push-in', props: [P('hourglass', 'rise', 'top')], sfx: [S('ding', 'start')] }), [t('l’habitude.', 'habit.')]));
  return {
    title: t(`Combien te coûte vraiment ${name} ?`, `What does ${name} really cost you?`),
    beats,
    assumptions: [
      ...(assumedPrice ? [t(`Prix supposé : ${dm} par jour.`, `Assumed price: ${dm} per day.`)] : []),
      t(`Rendement hypothétique de ${pct(r)} par an, non garanti.`, `Hypothetical ${pct(r)} yearly return, not guaranteed.`),
    ],
    claims: [
      { text: `${dm} × 365 ≈ ${m(yearly)}`, kind: 'calculation' },
      { text: `FV(${m(monthly)}/m, ${pct(r)}, 30) ≈ ${m(fv30)}`, kind: 'calculation' },
    ],
    hashtags: t('#finance #budget #habitudes #epargne', '#finance #budget #habits #saving').split(' '),
  };
}

/* ------------------------------------------------------------------ */
/* 4. Debt: "€5,000 on a credit card, paying only the minimum"          */
/* ------------------------------------------------------------------ */
function debt(p: ParsedTopic, c: Ctx): ArchetypeOutput {
  const { t, m, pct } = c;
  const B = p.amount ?? 5000;
  const apr = p.rate ?? 0.2;
  const minPct = 0.03;
  const minAbs = c.cur === 'EUR' ? 20 : 25;
  const mini = payoffMinimum(B, apr, minPct, minAbs);
  const fixed = roundFriendly(Math.max(mini.firstPayment * 2, B / 24));
  const fix = payoffFixed(B, apr, fixed);
  const yrs = (months: number) => formatDecimal(Math.round((months / 12) * 10) / 10, c.lang);
  const saved = mini.totalInterest - fix.totalInterest;
  const Bm = m(B);
  const beats: Beat[] = [
    beat(
      c.style === 'unexpected'
        ? t(`Payer le minimum sur ta carte, c’est la façon la plus chère de rembourser.`, `Paying the minimum on your card is the most expensive way to pay it back.`)
        : t(`${Bm} sur ta carte de crédit. Et tu ne paies que le minimum chaque mois.`, `${Bm} on your credit card. And you only pay the minimum each month.`),
      d({ pose: 'holding-phone', expr: 'worried', bg: 'spotlight', cam: 'push-in', tr: 'cut', props: [P('credit-card', 'pop', 'top-right')], overlay: { text: `-${Bm}`, style: 'warning' }, sfx: [S('heartbeat', 'start')] }),
      words(Bm),
      [t('minimum', 'minimum')],
    ),
    beat(t(`Hypothèse : un taux de ${pct(apr)} par an, et un minimum de ${pct(minPct)} du solde.`, `Assumption: a ${pct(apr)} yearly rate, and a minimum of ${pct(minPct)} of the balance.`), d({ pose: 'explaining', expr: 'neutral', pos: 'left', bg: 'grid', props: [P('percent-badge', 'pop', 'right')], overlay: { text: t(`${pct(apr)} / an`, `${pct(apr)} / year`), style: 'label' }, sfx: [S('tick', 'start')] }), [pct(apr), pct(minPct)]),
    beat(t(`Le premier mois, tu paies ${m(mini.firstPayment)}. Ça semble gérable.`, `The first month, you pay ${m(mini.firstPayment)}. Seems manageable.`), d({ pose: 'happy', expr: 'happy', pos: 'left', bg: 'floor', tr: 'slide-left', props: [P('banknote', 'slide-right', 'right', { count: 2 })], overlay: { text: m(mini.firstPayment), style: 'number' }, sfx: [S('coin', 'middle')] }), words(m(mini.firstPayment))),
    beat(t(`Mais sur ce paiement, ${m(mini.firstInterest)} partent directement en intérêts.`, `But of that payment, ${m(mini.firstInterest)} goes straight to interest.`), d({ pose: 'shocked', expr: 'shocked', pos: 'left', bg: 'vignette', cam: 'zoom-in', props: [P('bank', 'pop', 'right'), P('coin', 'slide-right', 'center', { count: 3, delay: 0.3 })], sfx: [S('fail', 'end')] }), words(m(mini.firstInterest)), [t('intérêts.', 'interest.')]),
    beat(t('Et chaque mois, le minimum baisse avec le solde… donc la dette recule très lentement.', 'And each month the minimum shrinks with the balance… so the debt shrinks very slowly.'), d({ pose: 'sad', expr: 'sad', bg: 'vignette', chart: { kind: 'line', trend: 'down', values: [100, 97, 94, 92, 89, 87, 85, 83] }, sfx: [S('tick', 'middle')] }), [], [t('lentement.', 'slowly.')]),
    beat(mini.paidOff ? t(`Résultat : il te faudrait environ ${yrs(mini.months)} ans pour tout rembourser.`, `Result: it would take you about ${yrs(mini.months)} years to pay it off.`) : t('Résultat : avec ce minimum, la dette ne disparaît presque jamais.', 'Result: with that minimum, the debt almost never goes away.'), d({ pose: 'shocked', expr: 'shocked', bg: 'spotlight', cam: 'shake', tr: 'cut', fx: 'impact', props: [P('clock', 'shake', 'top-right')], overlay: { text: mini.paidOff ? t(`${yrs(mini.months)} ans`, `${yrs(mini.months)} years`) : '∞', style: 'warning' }, sfx: [S('impact', 'start')] }), [], [yrs(mini.months), t('ans', 'years')]),
    beat(t(`Et tu aurais payé environ ${m(mini.totalInterest)} d’intérêts en plus.`, `And you would have paid about ${m(mini.totalInterest)} in extra interest.`), d({ pose: 'sad', expr: 'worried', pos: 'left', bg: 'vignette', props: [P('receipt', 'fall', 'right', { count: 4 })], overlay: { text: `+${m(mini.totalInterest)}`, style: 'warning', counter: c.counter(mini.totalInterest) }, sfx: [S('cash', 'middle')] }), [], words(m(mini.totalInterest))),
    beat(t(`Maintenant, paie ${m(fixed)} fixes par mois au lieu du minimum.`, `Now, pay a fixed ${m(fixed)} a month instead of the minimum.`), d({ pose: 'pointing', expr: 'determined', pos: 'left', bg: 'spotlight', tr: 'wipe', props: [P('calendar', 'pop', 'right')], overlay: { text: t(`${m(fixed)} / mois`, `${m(fixed)} / month`), style: 'number' }, sfx: [S('swoosh', 'start')] }), words(m(fixed))),
    beat(t(`Tu es libéré en ${yrs(fix.months)} ans, et tu économises environ ${m(saved)}.`, `You are debt-free in ${yrs(fix.months)} years, and you save about ${m(saved)}.`), d({ pose: 'celebrating', expr: 'excited', bg: 'floor', fx: 'confetti', props: [P('lock', 'spin', 'top-right')], overlay: { text: m(saved), style: 'number', counter: c.counter(saved) }, sfx: [S('ding', 'start')] }), [...words(m(saved)), yrs(fix.months), t('libéré', 'debt-free')]),
    beat(t('La différence ? Rembourser plus que ce que les intérêts ajoutent.', 'The difference? Paying more than the interest adds.'), d({ pose: 'explaining', expr: 'smug', pos: 'left', bg: 'grid', chart: { kind: 'line', trend: 'down', values: [100, 88, 75, 62, 48, 33, 18, 2] }, sfx: [S('pop', 'middle')] }), [t('plus', 'more')]),
  ];
  beats.push(beat(t('Une dette n’est pas juste un montant. C’est un compteur qui tourne.', 'Debt is not just a number. It is a meter that keeps running.'), d({ pose: 'idle', expr: 'determined', bg: 'spotlight', cam: 'push-in', props: [P('hourglass', 'rise', 'top')], sfx: [S('tick', 'start')] }), [t('compteur', 'meter')]));
  return {
    title: t(`${Bm} de dette : le piège du paiement minimum`, `${Bm} of debt: the minimum payment trap`),
    beats,
    assumptions: [t(`Taux hypothétique de ${pct(apr)} par an, minimum de ${pct(minPct)} du solde (au moins ${m(minAbs)}).`, `Hypothetical ${pct(apr)} APR, minimum of ${pct(minPct)} of the balance (at least ${m(minAbs)}).`), t('Aucun nouvel achat sur la carte.', 'No new purchases on the card.')],
    claims: [
      { text: `Minimum: ${mini.months} months, interest ≈ ${m(mini.totalInterest)}`, kind: 'calculation' },
      { text: `Fixed ${m(fixed)}: ${fix.months} months, interest ≈ ${m(fix.totalInterest)}`, kind: 'calculation' },
    ],
    hashtags: t('#finance #dette #credit #budget', '#finance #debt #creditcard #budget').split(' '),
  };
}

/* ------------------------------------------------------------------ */
/* 5. Start early: "Investing at 25 vs 35"                             */
/* ------------------------------------------------------------------ */
function startEarly(p: ParsedTopic, c: Ctx): ArchetypeOutput {
  const { t, m, pct } = c;
  const [a1, a2] = p.ages && p.ages.length >= 2 ? [Math.min(...p.ages), Math.max(...p.ages)] : [p.age ?? 25, (p.age ?? 25) + 10];
  const P0 = p.amount ?? 200;
  const r = p.rate ?? 0.06;
  const end = 65;
  const fvA = futureValueMonthly(P0, r, end - a1);
  const fvB = futureValueMonthly(P0, r, end - a2);
  const cA = P0 * 12 * (end - a1);
  const cB = P0 * 12 * (end - a2);
  const ratio = formatDecimal(Math.round((fvA / fvB) * 10) / 10, c.lang);
  const beats: Beat[] = [
    beat(t(`Deux amis investissent la même somme. L’un commence à ${a1} ans, l’autre à ${a2} ans.`, `Two friends invest the same amount. One starts at ${a1}, the other at ${a2}.`), d({ pose: 'explaining', expr: 'neutral', bg: 'spotlight', tr: 'cut', cam: 'push-in', overlay: { text: `${a1} vs ${a2}`, style: 'headline' }, sfx: [S('whoosh', 'start')] }), [String(a1), String(a2)]),
    beat(t(`Chacun place ${m(P0)} par mois, jusqu’à ${end} ans.`, `Each one invests ${m(P0)} a month, until ${end}.`), d({ pose: 'holding-money', expr: 'happy', pos: 'left', bg: 'floor', props: [P('piggy-bank', 'pop', 'right')], overlay: { text: t(`${m(P0)} / mois`, `${m(P0)} / month`), style: 'number' }, sfx: [S('coin', 'middle')] }), words(m(P0))),
    beat(t(`Hypothèse : ${pct(r)} par an en moyenne. Ce n’est pas garanti.`, `Assumption: ${pct(r)} a year on average. It is not guaranteed.`), d({ pose: 'thinking', expr: 'thinking', pos: 'right', facing: 'left', bg: 'grid', tr: 'slide-up', chart: { kind: 'line', trend: 'volatile', values: [100, 109, 103, 118, 112, 127, 121, 136] }, overlay: { text: t(`${pct(r)} / an`, `${pct(r)} / year`), style: 'label' }, sfx: [S('tick', 'start')] }), [pct(r)], [t('garanti.', 'guaranteed.')]),
    beat(t(`Celui qui commence à ${a1} ans verse ${m(cA)} au total.`, `The one who starts at ${a1} puts in ${m(cA)} in total.`), d({ pose: 'pointing', expr: 'neutral', pos: 'left', bg: 'floor', tr: 'slide-left', props: [P('coin-stack', 'grow', 'right')], overlay: { text: m(cA), style: 'number', counter: c.counter(cA) } }), words(m(cA))),
    beat(t(`Celui de ${a2} ans verse ${m(cB)}.`, `The one who starts at ${a2} puts in ${m(cB)}.`), d({ pose: 'pointing', expr: 'neutral', pos: 'right', facing: 'left', bg: 'floor', tr: 'slide-left', props: [P('coin-stack', 'grow', 'left')], overlay: { text: m(cB), style: 'number', counter: c.counter(cB) } }), words(m(cB))),
    beat(t(`À ${end} ans, le premier a environ ${m(fvA)}.`, `At ${end}, the first one has about ${m(fvA)}.`), d({ pose: 'celebrating', expr: 'excited', bg: 'spotlight', cam: 'zoom-in', fx: 'money-rain', props: [P('money-bag', 'grow', 'bottom')], overlay: { text: m(fvA), style: 'number', counter: c.counter(fvA) }, sfx: [S('cash', 'middle')] }), words(m(fvA))),
    beat(t(`Le second, environ ${m(fvB)}.`, `The second one, about ${m(fvB)}.`), d({ pose: 'sad', expr: 'sad', bg: 'vignette', props: [P('money-stack', 'pop', 'bottom')], overlay: { text: m(fvB), style: 'number', counter: c.counter(fvB) }, sfx: [S('fail', 'end')] }), words(m(fvB))),
    beat(t(`Dix ans d’avance… et environ ${ratio} fois plus d’argent.`, `Ten years ahead… and about ${ratio} times more money.`).replace(t('Dix', 'Ten'), a2 - a1 === 10 ? t('Dix', 'Ten') : String(a2 - a1)), d({ pose: 'shocked', expr: 'shocked', bg: 'spotlight', cam: 'shake', tr: 'cut', fx: 'impact', overlay: { text: `×${ratio}`, style: 'number' }, sfx: [S('impact', 'start')] }), [ratio, t('fois', 'times')]),
    beat(t('Pourquoi ? Parce que les premiers euros investis ont le plus de temps pour grossir.', 'Why? Because the first money invested has the most time to grow.').replace('euros', c.cur === 'EUR' ? 'euros' : c.cur === 'USD' ? 'dollars' : 'livres'), d({ pose: 'explaining', expr: 'thinking', pos: 'left', bg: 'grid', chart: { kind: 'bar', trend: 'up', values: Array.from({ length: 8 }, (_, i) => Math.round(futureValueMonthly(P0, r, ((end - a1) * (i + 1)) / 8))) }, sfx: [S('riser', 'start')] }), [t('temps', 'time')]),
    beat(t('Chaque année d’attente coûte plus cher que la précédente.', 'Every year you wait costs more than the one before.'), d({ pose: 'thinking', expr: 'worried', bg: 'vignette', props: [P('clock', 'shake', 'top-right'), P('calendar', 'pop', 'top-left', { delay: 0.4 })], sfx: [S('tick', 'start')] }), [], [t('attente', 'wait')]),
  ];
  beats.push(beat(t('Le temps est le seul investissement qu’on ne peut pas rattraper.', 'Time is the one investment you can never catch up on.'), d({ pose: 'idle', expr: 'determined', bg: 'spotlight', cam: 'push-in', props: [P('hourglass', 'rise', 'top')], sfx: [S('ding', 'start')] }), [t('temps', 'Time')]));
  return {
    title: t(`Investir à ${a1} ans ou à ${a2} ans : la vraie différence`, `Investing at ${a1} vs ${a2}: the real difference`),
    beats,
    assumptions: [t(`${m(P0)} par mois jusqu’à ${end} ans, rendement hypothétique de ${pct(r)} par an.`, `${m(P0)} a month until ${end}, hypothetical ${pct(r)} yearly return.`)],
    claims: [
      { text: `FV(${m(P0)}/m, ${pct(r)}, ${end - a1}) ≈ ${m(fvA)}`, kind: 'calculation' },
      { text: `FV(${m(P0)}/m, ${pct(r)}, ${end - a2}) ≈ ${m(fvB)}`, kind: 'calculation' },
    ],
    hashtags: t('#finance #investissement #interetscomposes', '#finance #investing #compoundinterest').split(' '),
  };
}

export function writeArchetype(parsed: ParsedTopic, lang: OfflineLanguage, style: StorytellingStyle): ArchetypeOutput {
  const ctx = makeCtx(lang, parsed.currency, style);
  switch (parsed.archetype) {
    case 'windfall':
      return windfall(parsed, ctx);
    case 'invest-monthly':
      return investMonthly(parsed, ctx);
    case 'habit':
      return habit(parsed, ctx);
    case 'debt':
      return debt(parsed, ctx);
    case 'start-early':
      return startEarly(parsed, ctx);
    default:
      throw new Error('No archetype');
  }
}
