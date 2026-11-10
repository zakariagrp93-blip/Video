import type { Background, CameraMove, Effect, Expression, Language, Pose, PropAsset, SfxType, Transition } from '../../shared/constants';
import type { SceneProp, ScriptScene, StoryboardScene } from '../../shared/schemas';

/**
 * Rule-based visual director: turns a free-text scene (narration + visual
 * description) into structured direction using the asset vocabulary. Used when
 * a scene has no structured direction (and as a repair fallback).
 */
const PROP_KEYWORDS: Array<[RegExp, PropAsset]> = [
  [/voiture de sport|sports? car|deportivo|sportwagen|ferrari|lambo/i, 'sports-car'],
  [/voiture|car\b|coche|auto\b|wagen/i, 'car'],
  [/manoir|villa|mansion|mansión/i, 'mansion'],
  [/maison|appart|house|home|casa|piso|haus|wohnung|immobili|real estate|loyer|rent/i, 'house'],
  [/banque|bank|banco/i, 'bank'],
  [/téléphone|phone|smartphone|móvil|handy|appli|app\b/i, 'phone'],
  [/carte|card|tarjeta|karte/i, 'credit-card'],
  [/ordinateur|laptop|computer|ordenador/i, 'laptop'],
  [/action|bourse|stock|market|marché|mercado|börse|etf|rendement|return|croissance|growth|intérêts composés|compound/i, 'chart-up'],
  [/krach|crash|perte|loss|pérdida|verlust|chute|drop|baisse/i, 'chart-down'],
  [/heure|horloge|clock|reloj|uhr|temps|time/i, 'clock'],
  [/sablier|hourglass|patience|attendre|wait/i, 'hourglass'],
  [/immeuble|building|tour|edificio|gebäude|entreprise|company/i, 'building'],
  [/magasin|boutique|shop|store|tienda|laden/i, 'shop'],
  [/tirelire|piggy|épargn|saving|ahorr|spar/i, 'piggy-bank'],
  [/mois|month|mes|monat|calendrier|calendar|année|year|año|jahr/i, 'calendar'],
  [/cadeau|gift|regalo|geschenk/i, 'gift'],
  [/portefeuille|wallet|cartera|geldbörse/i, 'wallet'],
  [/salaire|salary|job|travail|work|emploi|trabajo|arbeit/i, 'briefcase'],
  [/facture|bill|receipt|ticket|recibo|rechnung|taxe|tax|impôt|impuesto|steuer|frais|fees/i, 'receipt'],
  [/voyage|vacances|travel|trip|vacation|viaje|reise|avion|plane/i, 'plane'],
  [/diplôme|diploma|degree|titulo/i, 'diploma'],
  [/études|université|university|school|école|college|student/i, 'graduation-cap'],
  [/shopping|achat|buy|purchase|compra|kauf|dépens|spend|gast/i, 'shopping-bag'],
  [/%|pourcent|percent|taux|rate|tasa|zins|inflation/i, 'percent-badge'],
  [/sécurité|secure|lock|bloqu|verrou|sécuris/i, 'lock'],
  [/café|coffee|kaffee/i, 'coffee'],
  [/yacht|bateau|boat|barco/i, 'yacht'],
  [/trophée|trophy|gagn|win|victoire|success/i, 'trophy'],
  [/pièces?|coins?|monedas|münzen/i, 'coin'],
  [/billet|banknote|cash|liquide|efectivo|bargeld/i, 'banknote'],
  [/million|milliard|fortune|riche|rich|rico|reich|patrimoine|wealth/i, 'money-stack'],
  [/sac d'argent|money bag/i, 'money-bag'],
  [/argent|money|dinero|geld|€|\$|£|euros?|dollars?/i, 'money-stack'],
];

const NEGATIVE = /perte|loss|perd|lose|dette|debt|deuda|schulden|crash|problème|problem|attention|careful|piège|trap|ruine|broke|inflation|impôt|tax|frais|fees|cher|expensive|danger|risque|risk|jamais|never|pire|worst/i;
const POSITIVE = /gagn|win|riche|rich|libre|free|bonus|gain|profit|double|triple|million|réussi|success|heureux|happy|incroyable|amazing/i;
const QUESTION = /\?$/;

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

export function directScene(s: ScriptScene, index: number, total: number, _language: Language): StoryboardScene {
  void _language;
  const text = `${s.narration} ${s.visual} ${s.characterAction}`;
  const props: SceneProp[] = [];
  const seen = new Set<PropAsset>();
  for (const [re, asset] of PROP_KEYWORDS) {
    if (props.length >= 2) break;
    if (re.test(text) && !seen.has(asset)) {
      seen.add(asset);
      props.push({ asset, animation: props.length === 0 ? 'pop' : 'slide-left', placement: props.length === 0 ? 'right' : 'top-right', count: 1, delay: props.length * 0.35 });
    }
  }
  const negative = NEGATIVE.test(s.narration);
  const positive = !negative && POSITIVE.test(s.narration);
  const question = QUESTION.test(s.narration.trim());
  const hasNumber = /\d/.test(s.narration);
  let pose: Pose = 'explaining';
  let expression: Expression = 'neutral';
  if (index === 0) {
    pose = question ? 'thinking' : 'surprised';
    expression = 'surprised';
  } else if (index === total - 1) {
    pose = 'idle';
    expression = 'determined';
  } else if (negative) {
    pose = pick(['sad', 'shocked', 'thinking'] as const, index);
    expression = pose === 'shocked' ? 'shocked' : 'worried';
  } else if (positive) {
    pose = pick(['happy', 'celebrating', 'holding-money'] as const, index);
    expression = pose === 'celebrating' ? 'excited' : 'happy';
  } else if (question) {
    pose = 'thinking';
    expression = 'thinking';
  } else if (hasNumber) {
    pose = 'pointing';
    expression = 'neutral';
  }
  if (seen.has('phone')) pose = 'holding-phone';
  const position = props.length ? 'left' : 'center';
  const effect: Effect = negative ? (index % 2 ? 'impact' : 'smoke') : positive ? (seen.has('money-stack') ? 'money-rain' : 'sparkles') : 'none';
  const camera: CameraMove = index === 0 || index === total - 1 ? 'push-in' : negative ? 'shake' : pick(['static', 'zoom-in', 'zoom-out', 'pan-left'] as const, index);
  const background: Background = negative ? 'vignette' : pick(['spotlight', 'floor', 'grid'] as const, index);
  const transition: Transition = index === 0 ? 'cut' : pick(['fade', 'slide-left', 'slide-up', 'wipe'] as const, index);
  const sfx: Array<{ type: SfxType; at: 'start' | 'middle' | 'end' }> = [];
  if (negative) sfx.push({ type: effect === 'impact' ? 'impact' : 'fail', at: 'start' });
  else if (positive) sfx.push({ type: 'cash', at: 'middle' });
  else if (props.length) sfx.push({ type: 'pop', at: 'start' });
  return {
    id: `s${String(index + 1).padStart(2, '0')}`,
    narration: s.narration,
    emphasis: s.emphasis,
    negative: s.negative,
    durationHint: s.durationHint,
    visualDescription: s.visual,
    character: { visible: true, pose, expression, position, motion: index === 1 ? 'enter-left' : 'none', facing: 'right' },
    background,
    props,
    effect,
    camera,
    transition,
    textOverlay: null,
    chart: seen.has('chart-up') ? { kind: 'line', trend: 'up', values: [10, 14, 13, 19, 24, 23, 31, 40] } : seen.has('chart-down') ? { kind: 'line', trend: 'down', values: [40, 36, 38, 29, 25, 18, 15, 9] } : null,
    sfx,
  };
}
