import {
  BACKGROUNDS,
  CAMERA_MOVES,
  CHARACTER_MOTIONS,
  EFFECTS,
  EXPRESSIONS,
  LANGUAGE_LABELS,
  MOTIFS,
  POSES,
  PROP_ANIMATIONS,
  PROP_ASSETS,
  PROP_PLACEMENTS,
  SFX_TYPES,
  STORYTELLING_LABELS,
  TRANSITIONS,
} from '../../../shared/constants';
import type { Script, ScriptRequest, Storyboard } from './llmTypes';

export const SCRIPT_SYSTEM = `You write narration for short vertical finance videos (TikTok / Reels / Shorts) in the style of minimalist financial storytelling: a white cartoon mascot on a black background, simple financial objects, white captions with yellow and red highlights.

Writing rules:
- Open with a hook that creates curiosity in the first 2 seconds. No greetings, no "in this video".
- Build a clear progression: situation → stakes rise → consequences → payoff.
- Every scene must be visualisable with simple objects (money, coins, cards, phones, houses, cars, charts, clocks).
- Short spoken sentences. One idea per scene. Natural spoken rhythm in the target language, not a translation.
- End with a memorable final sentence that recontextualises the story.
- Never invent statistics, studies or historical figures. Numbers must be either (a) simple arithmetic you show, or (b) explicitly framed hypotheses ("Assumption: 5% a year — not guaranteed").
- Any claim of kind "fact" needs a verifiable source; prefer hypotheses and calculations.
- Clearly separate hypothetical scenarios from real facts. No financial advice; no promises of returns.
- Avoid generic AI phrasing (delve, unlock, game-changer, let's dive in), filler and repetitive sentence openings.
- Write numbers with digits as they should appear on screen (e.g. "1 000 000 €", "€1 million", "5 %").
- "emphasis" lists the exact words from that scene's narration that deserve a yellow highlight (key numbers, key concept); "negative" lists the exact words for a red highlight (losses, risks, costs).`;

export function scriptUserPrompt(req: ScriptRequest, feedback?: string[]): string {
  const { options } = req;
  return [
    `Topic: ${options.topic}`,
    `Language: ${LANGUAGE_LABELS[options.language]} (${options.language}). Write everything spoken in this language.`,
    `Storytelling mode: ${STORYTELLING_LABELS[options.storytelling]}.`,
    `Target length: about ${req.targetSeconds} seconds of narration, i.e. ${req.wordRange[0]}–${req.wordRange[1]} spoken words in total.`,
    `Scenes: between 8 and 15. durationHint = estimated seconds for that scene.`,
    'The first scene narration must start with the hook. The last scene narration must contain the final line.',
    'visual / characterAction / camera / animation / sfx: short English production notes for the animator.',
    feedback?.length ? `\nYour previous attempt was rejected for these reasons — fix all of them:\n- ${feedback.join('\n- ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const MOTIVATION_SCRIPT_SYSTEM = `You write narration for short vertical motivation edits (TikTok / Reels / Shorts) about money, discipline, success and mindset: cinematic black-and-gold shots, a deep calm narrator, a hard-hitting beat, huge words on screen.

Writing rules:
- 8 to 15 scenes. One short line per scene (4 to 16 words): punchy, rhythmic, spoken. Pauses matter as much as words.
- Scene 1 is the hook: a confronting statement that stops the scroll in 2 seconds. No greetings, no questions to the audience like "did you know".
- Arc: hook → the uncomfortable truth → the shift in thinking → the grind (what to do, daily) → the vision (what it becomes) → a final line that hits.
- Talk to one person ("you" / "tu"). Original lines only: no famous quotes, no names of real people, no brands.
- No financial promises, no get-rich-quick claims, no specific returns, no invented statistics. Motivation, not advice.
- Avoid clichés of AI writing (unlock, journey, game-changer, delve) and repetitive sentence openings.
- "emphasis": the 1–2 exact words of the line that carry it (shown in gold). "negative": exact words for pain/loss (shown in red), often empty.
- "visual": start with "motif:<one of the shot names>" chosen to match the line, then for motif:spotlight add "hero:<prop>". Shot names: ${MOTIFS.join(', ')}. Props for hero: sports-car, mansion, yacht, money-stack, coin-stack, credit-card, hourglass, trophy, diploma, lock, clock, laptop, briefcase.
- Mark the second line and the last line with " hit" at the end of "visual" (the beat drop / final impact).`;

export function motivationUserPrompt(req: ScriptRequest, feedback?: string[]): string {
  const { options } = req;
  return [
    `Topic / angle: ${options.topic}`,
    `Language: ${LANGUAGE_LABELS[options.language]} (${options.language}). Write everything spoken in this language, with a natural spoken rhythm — not a translation.`,
    `Target length: about ${req.targetSeconds} seconds including dramatic pauses, i.e. ${req.wordRange[0]}–${req.wordRange[1]} spoken words in total.`,
    'isHypothetical = false, assumptions = [], claims = [].',
    'The first scene narration must start with the hook. The last scene narration must contain the final line.',
    'characterAction / camera / animation / sfx: short English notes (free text).',
    feedback?.length ? `\nYour previous attempt was rejected for these reasons — fix all of them:\n- ${feedback.join('\n- ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const STORYBOARD_SYSTEM = `You are the storyboard director for a 2D minimalist finance animation (1080x1920, black background, one white rounded mascot named Nummo with simple black eyes). You convert a script into structured scene directions using ONLY the provided vocabulary.

Composition rules:
- The same mascot appears in (almost) every scene; keep continuity of position between consecutive scenes unless it moves on purpose.
- Props go on the side opposite the mascot (mascot "left" → props "right"/"top-right"); never two props on the same placement (except "around").
- "hand" placement only when the pose holds something (holding-money, holding-phone, pointing, explaining).
- Use at most 3 props per scene. Prefer clarity over clutter. Use charts only for growth/decline ideas. Do not combine a chart with a "center" prop.
- Text overlays: very short (max ~4 words) or an animated counter for key amounts.
- Vary camera moves and transitions; do not repeat the same camera move 3 times in a row. First scene transition = "cut".
- Sound effects: subtle, max 2 per scene; match the action (coin/cash for money, impact for shocks, tick for time, whoosh/swoosh for motion).
- illustrations: leave EMPTY unless an object is essential and impossible with the vector props; then give a short key (lowercase-dashes) and a prompt describing a flat 2D white-and-black minimalist object.`;

export function storyboardUserPrompt(script: Script, feedback?: string[]): string {
  const vocab = [
    `poses: ${POSES.join(', ')}`,
    `expressions: ${EXPRESSIONS.join(', ')}`,
    `motions: ${CHARACTER_MOTIONS.join(', ')}`,
    `props (asset): ${PROP_ASSETS.join(', ')}`,
    `prop animations: ${PROP_ANIMATIONS.join(', ')}`,
    `prop placements: ${PROP_PLACEMENTS.join(', ')}`,
    `backgrounds: ${BACKGROUNDS.join(', ')}`,
    `effects: ${EFFECTS.join(', ')}`,
    `camera: ${CAMERA_MOVES.join(', ')}`,
    `transitions: ${TRANSITIONS.join(', ')}`,
    `sfx: ${SFX_TYPES.join(', ')}`,
  ].join('\n');
  const scenes = script.scenes
    .map((s, i) => `Scene ${i + 1}\n  narration: ${s.narration}\n  visual: ${s.visual}\n  action: ${s.characterAction}\n  camera: ${s.camera}\n  animation: ${s.animation}\n  sfx: ${s.sfx}`)
    .join('\n');
  return [
    `Video title: ${script.title}`,
    `Return exactly ${script.scenes.length} scenes, in order, one per script scene.`,
    `Vocabulary:\n${vocab}`,
    `Script:\n${scenes}`,
    feedback?.length ? `\nYour previous storyboard was rejected — fix all of these:\n- ${feedback.join('\n- ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export const REVIEW_SYSTEM = `You review a storyboard for a minimalist finance animation. Report only concrete problems that would make the video confusing or visually broken: a prop that contradicts the narration, an expression opposite to the narration's emotion, a continuity break of the mascot, an unreadable overlay. Do not nitpick style. If it is fine, return ok=true with no issues.`;

export function reviewUserPrompt(sb: Storyboard): string {
  return sb.scenes
    .map(
      (s) =>
        `${s.id}: "${s.narration}" | mascot ${s.character.visible ? `${s.character.pose}/${s.character.expression} @${s.character.position}` : 'hidden'} | props ${s.props.map((p) => `${p.asset}@${p.placement}`).join(', ') || 'none'} | overlay ${s.textOverlay?.text ?? 'none'} | chart ${s.chart ? s.chart.trend : 'none'}`,
    )
    .join('\n');
}
