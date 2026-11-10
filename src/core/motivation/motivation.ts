import { MOTIFS, type Language, type Motif, type MotivationTheme, type Pose, type Expression, type PropAsset, PROP_ASSETS } from '../../shared/constants';
import type { Script, Storyboard, StoryboardScene } from '../../shared/schemas';
import { prng, seedFrom } from '../audio/synth';
import { wordCount } from '../text/speech';
import { HASHTAGS, LINES, type Section } from './lines';

/**
 * Motivation edits: short, punchy lines over full-frame cinematic shots, a
 * beat-driven soundtrack and big kinetic typography. This module writes the
 * script offline (French and English) and directs any motivation script —
 * offline or from an LLM — into storyboard scenes.
 */

export interface EditBeat {
  text: string;
  emphasis: string[];
  negative: string[];
  motif: Motif;
  hero?: PropAsset;
  /** Impact + flash (drop / final line). */
  hit: boolean;
  section: Section;
}

const THEME_KEYWORDS: Record<MotivationTheme, RegExp> = {
  money: /\b(argent|riche|richesse|million|fortune|thune|oseille|business|entrepreneur|investi|money|rich|wealth|cash|dinero|rico|riqueza|geld|reich|reichtum|salaire|salary|liberté financière)/i,
  discipline: /\b(discipline|disciplina|disziplin|travail|bosser|grind|work|routine|habitude|habit|matin|morning|5h|sport|gym|muscu|entraîn|train|trabajo|arbeit|réveil|alarm)/i,
  success: /\b(réussi|réussite|succès|success|win|gagn|objectif|goal|rêve|dream|ambition|éxito|exito|erfolg|ziel|sommet|top|champion|victoire|victory)/i,
  mindset: /\b(mental|mindset|esprit|mind|solitude|alone|seul|peur|fear|doute|doubt|échec|echec|fail|confiance|confidence|mentalidad|angst|calme|paix|peace|pensée|think)/i,
};

export function detectTheme(topic: string): MotivationTheme {
  const scores = (Object.keys(THEME_KEYWORDS) as MotivationTheme[]).map((t) => [t, (topic.match(new RegExp(THEME_KEYWORDS[t].source, 'gi')) ?? []).length] as const);
  const best = [...scores].sort((a, b) => b[1] - a[1])[0]!;
  return best[1] > 0 ? best[0] : 'money';
}

const INSTRUCTION = /^(fais|fait|faire|cr[ée]e[rz]?|g[ée]n[èe]re[rz]?|une vid[ée]o|vid[ée]o|make|create|generate|a video|video|tiktok|edit|montage|motivation)\b/i;

/** Use the user's topic as the opening line when it reads like a line (not an instruction or a label). */
const SENTENCE_MARKER = /(^|[\s'’])(tu|te|t|ton|ta|tes|toi|vous|je|j|il|ils|elle|on|nous|personne|rien|ne|n|est|sont|sera|you|your|they|we|nobody|nothing|is|are|will|can|don|won)(?=$|[\s'’.,!?])/i;

export function topicAsHook(topic: string): string | null {
  // "Theme: the line" → the line.
  const afterColon = topic.includes(':') ? topic.slice(topic.lastIndexOf(':') + 1) : topic;
  let t = afterColon.trim().replace(/\s+/g, ' ');
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!SENTENCE_MARKER.test(t)) return null;
  const words = t.split(' ').length;
  if (words < 4 || words > 18) return null;
  if (INSTRUCTION.test(t)) return null;
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

export function parseLine(line: string, section: Section): EditBeat {
  const bar = line.indexOf('|');
  const head = line.slice(0, bar);
  const raw = line.slice(bar + 1);
  const hit = head.endsWith('!');
  const [motifName, heroName] = head.replace('!', '').split(':') as [string, string | undefined];
  if (!(MOTIFS as readonly string[]).includes(motifName)) throw new Error(`Unknown motif "${motifName}" in line "${line}"`);
  if (heroName && !(PROP_ASSETS as readonly string[]).includes(heroName)) throw new Error(`Unknown prop "${heroName}" in line "${line}"`);
  const emphasis: string[] = [];
  const negative: string[] = [];
  const text = raw
    .replace(/\*([^*]+)\*/g, (_, w: string) => {
      emphasis.push(...w.split(/\s+/));
      return w;
    })
    .replace(/~([^~]+)~/g, (_, w: string) => {
      negative.push(...w.split(/\s+/));
      return w;
    });
  return { text, emphasis, negative, motif: motifName as Motif, hero: heroName as PropAsset | undefined, hit, section };
}

const firstWord = (t: string) => t.split(/\s+/)[0]?.toLowerCase().replace(/[^\p{L}]/gu, '') ?? '';

export interface MotivationScript {
  title: string;
  theme: MotivationTheme;
  beats: EditBeat[];
  hashtags: string[];
}

/** Section order of an edit, sized to the scene count. */
function sectionPlan(n: number): Section[] {
  const middle = n - 2;
  const pain = Math.max(1, Math.round(middle * 0.2));
  const vision = Math.max(1, Math.round(middle * 0.2));
  const truth = Math.max(1, Math.round((middle - pain - vision) / 2));
  const grind = Math.max(1, middle - pain - vision - truth);
  return ['hook', ...Array<Section>(pain).fill('pain'), ...Array<Section>(truth).fill('truth'), ...Array<Section>(grind).fill('grind'), ...Array<Section>(vision).fill('vision'), 'close'];
}

export function writeMotivation(opts: { topic: string; language: 'fr' | 'en'; wordRange: [number, number]; seed?: number }): MotivationScript {
  const theme = detectTheme(opts.topic);
  const bank = LINES[opts.language][theme];
  const rnd = prng(opts.seed ?? seedFrom(opts.topic));
  const [, max] = opts.wordRange;
  const avg = 10;
  let n = Math.max(8, Math.min(15, Math.round(max / avg)));
  const pools: Record<Section, string[]> = Object.fromEntries((Object.keys(bank) as Section[]).map((k) => [k, shuffle([...bank[k]], rnd)])) as Record<Section, string[]>;
  // Sections only have so many lines; cap the scene count to what the bank can fill.
  const capacity = (Object.keys(pools) as Section[]).reduce((a, k) => a + pools[k].length, 0);
  n = Math.min(n, capacity);
  const plan = sectionPlan(n);
  const beats: EditBeat[] = [];
  const firstCount = new Map<string, number>();
  const motifCount = new Map<string, number>();
  const userHook = topicAsHook(opts.topic);
  // Short videos still need 8 lines: then prefer the tightest lines of each section.
  const tight = max / n < 9.5;
  if (tight) for (const k of Object.keys(pools) as Section[]) pools[k].sort((x, y) => wordCount(x.split('|')[1]!) - wordCount(y.split('|')[1]!));
  for (const section of plan) {
    if (section === 'hook' && userHook) {
      const words = userHook.replace(/[.!?…]+$/, '').split(/\s+/);
      const key = [...words].sort((a, b) => b.length - a.length)[0]!.replace(/[^\p{L}\p{N}'’-]/gu, '');
      beats.push({ text: userHook, emphasis: [key], negative: [], motif: parseLine(pools.hook[0]!, 'hook').motif, hero: parseLine(pools.hook[0]!, 'hook').hero, hit: false, section });
      firstCount.set(firstWord(userHook), 2);
      motifCount.set(beats[0]!.motif, 1);
      continue;
    }
    // Borrow from the neighbouring section when a pool runs dry.
    const order: Section[] = [section, ...(['truth', 'grind', 'vision', 'pain'] as Section[]).filter((s) => s !== section)];
    let picked: EditBeat | null = null;
    for (const s of order) {
      const pool = pools[s];
      // Variety: an opening word at most twice (the hook's once), a shot at most twice (hero objects excepted), never twice in a row.
      const ok = (l: string, strict: boolean) => {
        const b = parseLine(l, s);
        const prev = beats[beats.length - 1];
        const fw = (firstCount.get(firstWord(b.text)) ?? 0) < 2;
        const varied = !prev || prev.motif !== b.motif;
        const fresh = b.motif === 'spotlight' || (motifCount.get(b.motif) ?? 0) < 2;
        return fw && varied && (!strict || fresh);
      };
      let idx = pool.findIndex((l) => ok(l, true));
      if (idx < 0) idx = pool.findIndex((l) => ok(l, false));
      const i = idx >= 0 ? idx : pool.length ? 0 : -1;
      if (i < 0) continue;
      picked = { ...parseLine(pool[i]!, s), section };
      pool.splice(i, 1);
      break;
    }
    if (!picked) break;
    firstCount.set(firstWord(picked.text), (firstCount.get(firstWord(picked.text)) ?? 0) + (section === 'hook' ? 2 : 1));
    motifCount.set(picked.motif, (motifCount.get(picked.motif) ?? 0) + 1);
    beats.push(picked);
  }
  // Too long: drop middle beats (never the hook or the close) until the length fits.
  const total = () => beats.reduce((a, b) => a + wordCount(b.text), 0);
  while (total() > max && beats.length > 8) {
    let longest = 1;
    for (let i = 2; i < beats.length - 1; i++) if (wordCount(beats[i]!.text) > wordCount(beats[longest]!.text)) longest = i;
    beats.splice(longest, 1);
  }
  // The drop lands on the second line: make it hit.
  if (beats[1]) beats[1].hit = true;
  return { title: beats[0]!.text.replace(/[.!…]+$/, '').slice(0, 110), theme, beats, hashtags: HASHTAGS[opts.language][theme] };
}

function shuffle<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/* ------------------------------------------------------------------ */
/* Direction                                                            */
/* ------------------------------------------------------------------ */

/** Motifs where the mascot appears as a back-lit silhouette, with its pose. */
const SILHOUETTE: Partial<Record<Motif, { pose: Pose; expression: Expression }>> = {
  skyline: { pose: 'idle', expression: 'determined' },
  road: { pose: 'walking', expression: 'determined' },
  mountain: { pose: 'idle', expression: 'determined' },
  stairs: { pose: 'walking', expression: 'determined' },
  rain: { pose: 'idle', expression: 'worried' },
  sunrise: { pose: 'idle', expression: 'determined' },
  crowd: { pose: 'idle', expression: 'determined' },
  desk: { pose: 'sitting', expression: 'thinking' },
};

const CAMERAS = ['push-in', 'pan-left', 'zoom-out', 'pan-right', 'push-in', 'tilt'] as const;

export function directEditScene(beat: Omit<EditBeat, 'section'> & { section?: Section }, i: number, n: number, durationHint: number): StoryboardScene {
  const sil = SILHOUETTE[beat.motif];
  const last = i === n - 1;
  const hero = beat.motif === 'spotlight' ? (beat.hero ?? 'money-stack') : beat.hero;
  return {
    id: `s${String(i + 1).padStart(2, '0')}`,
    narration: beat.text,
    emphasis: beat.emphasis,
    negative: beat.negative,
    durationHint,
    visualDescription: `${beat.motif}${hero ? ` (${hero})` : ''}`,
    character: {
      visible: !!sil,
      pose: last && sil && beat.motif !== 'desk' ? 'celebrating' : (sil?.pose ?? 'idle'),
      expression: sil?.expression ?? 'determined',
      position: 'center',
      motion: 'none',
      facing: i % 2 ? 'left' : 'right',
    },
    background: 'black',
    props: hero && beat.motif === 'spotlight' ? [{ asset: hero, animation: 'float', placement: 'center', count: 1, delay: 0 }] : [],
    effect: beat.hit ? 'impact' : beat.motif === 'spotlight' && /money|coin|banknote|trophy|yacht|mansion|sports-car/.test(hero ?? '') ? 'sparkles' : beat.motif === 'rain' || beat.motif === 'mountain' ? 'smoke' : 'none',
    camera: CAMERAS[i % CAMERAS.length]!,
    transition: i === 0 ? 'cut' : beat.hit ? 'zoom-through' : i % 3 === 0 ? 'fade' : 'cut',
    textOverlay: null,
    chart: null,
    sfx: beat.hit ? [{ type: 'impact', at: 'start' }] : [],
    motif: beat.motif,
  };
}

/** Keyword → shot, for scripts written by an LLM (any of the four languages). */
const MOTIF_KEYWORDS: Array<[RegExp, Motif, PropAsset?]> = [
  [/\b(voiture|car|coche|auto|lambo|ferrari|porsche)\b/i, 'spotlight', 'sports-car'],
  [/\b(maison|villa|house|mansion|casa|haus)\b/i, 'spotlight', 'mansion'],
  [/\b(yacht|bateau|boat|barco|boot)\b/i, 'spotlight', 'yacht'],
  [/\b(montre|watch|reloj|uhr)\b/i, 'spotlight', 'clock'],
  [/\b(troph|médaille|medal|gagn|win|won|ganar|gewinn|champion)/i, 'spotlight', 'trophy'],
  [/\b(argent|money|dinero|geld|cash|euro|dollar|salaire|salary|paycheck|sueldo|gehalt|million|riche|rich|rico|reich)/i, 'spotlight', 'money-stack'],
  [/\b(investi|invest|intérêt|interest|compound|composé|dividend)/i, 'spotlight', 'coin-stack'],
  [/\b(carte|card|tarjeta|karte|achet|buy|shopping|dépens|spend|gastar|ausgeb)/i, 'spotlight', 'credit-card'],
  [/\b(temps|time|tiempo|zeit|années|years|años|jahre|heure|hour|hora|stunde)\b/i, 'spotlight', 'hourglass'],
  [/\b(réveil|alarm|matin|morning|mañana|morgen|5h|cinq heures|five a\.?m)/i, 'alarm'],
  [/\b(gym|sport|muscu|entraîn|train|rep|répétition|cuerpo|body|corps|körper)/i, 'gym'],
  [/\b(sommet|montagne|mountain|top|summit|cima|gipfel|grimp|climb)/i, 'mountain'],
  [/\b(marche|escalier|step|stairs|staircase|escalera|treppe|stufe|petit à petit|little by little)/i, 'stairs'],
  [/\b(route|chemin|road|path|avance|keep moving|camino|weg|seul|alone|solo|allein)/i, 'road'],
  [/\b(pluie|pleut|rain|lluvia|regen|peur|fear|miedo|angst|doute|doubt|tombe|fall|échec|fail)/i, 'rain'],
  [/\b(échecs|chess|jeu|game|joue|play|stratég|strateg|contrôl|control|ajedrez|schach|pense|think|piensa|denk)/i, 'chess'],
  [/\b(tout le monde|everyone|todos|alle|autres|others|ils|they|gens|people|comparer|compare)/i, 'crowd'],
  [/\b(apprend|learn|lis|read|étud|study|travaille|work|bosse|aprend|lern|arbeit|silence)/i, 'desk'],
  [/\b(soleil|sun|aube|dawn|jour|day|demain|tomorrow|nouveau|new|commence|start|begin|empieza|beginn)/i, 'sunrise'],
  [/\b(ville|city|rêve|dream|sueño|traum|imagine|liberté|freedom|libertad|freiheit)/i, 'skyline'],
];

export function motifForText(text: string, recent: Motif[]): { motif: Motif; hero?: PropAsset } {
  for (const [re, motif, hero] of MOTIF_KEYWORDS) {
    if (re.test(text) && !recent.slice(-2).includes(motif)) return { motif, hero };
  }
  const fallback: Motif[] = ['skyline', 'road', 'stairs', 'chess', 'sunrise', 'mountain', 'desk', 'rain'];
  return { motif: fallback.find((m) => !recent.slice(-3).includes(m)) ?? 'skyline' };
}

/** Production note stored in Script.scenes[].visual so the storyboard can rebuild the shot. */
export function visualNote(b: Pick<EditBeat, 'motif' | 'hero' | 'hit'>): string {
  return `motif:${b.motif}${b.hero ? ` hero:${b.hero}` : ''}${b.hit ? ' hit' : ''}`;
}

export function parseVisualNote(visual: string): { motif: Motif; hero?: PropAsset; hit: boolean } | null {
  const m = /motif:([a-z-]+)/.exec(visual);
  if (!m || !(MOTIFS as readonly string[]).includes(m[1]!)) return null;
  const h = /hero:([a-z-]+)/.exec(visual);
  const hero = h && (PROP_ASSETS as readonly string[]).includes(h[1]!) ? (h[1] as PropAsset) : undefined;
  return { motif: m[1] as Motif, hero, hit: /\bhit\b/.test(visual) };
}

/** Direct a motivation script (offline or LLM) into a storyboard of full-frame edit shots. */
export function motivationStoryboard(script: Script): Storyboard {
  const recent: Motif[] = [];
  const n = script.scenes.length;
  const scenes = script.scenes.map((s, i) => {
    const note = parseVisualNote(s.visual);
    const shot = note && !(recent[recent.length - 1] === note.motif && note.motif !== 'spotlight') ? note : { ...motifForText(`${s.narration} ${s.visual}`, recent), hit: false };
    recent.push(shot.motif);
    return directEditScene({ text: s.narration, emphasis: s.emphasis, negative: s.negative, motif: shot.motif, hero: shot.hero, hit: shot.hit || i === 1 || i === n - 1 }, i, n, s.durationHint);
  });
  return { version: 1, title: script.title, language: script.language, characterId: 'nummo', scenes, illustrations: [] };
}

export function isMotivationLanguage(l: Language): l is 'fr' | 'en' {
  return l === 'fr' || l === 'en';
}
