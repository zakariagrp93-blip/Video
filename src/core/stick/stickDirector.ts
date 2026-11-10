import { LANGUAGE_LABELS } from '../../shared/constants';
import type { NarrationManifest, PlannedScene, Script, Storyboard, StoryboardScene } from '../../shared/schemas';
import { checkStickCode } from '../../shared/stick';
import { STICK_ENGINE_SOURCE, STICK_EXAMPLE_SHOTS } from '../../shared/stickEngine.generated';
import type { ProviderContext, ScriptRequest } from '../providers/types';
import type { TextRequest } from '../providers/llm/remoteLlm';
import { throwIfAborted, UserFacingError } from '../util/errors';

/**
 * Stick-figure explainers (format of the claude-animation-skills /stick-figure skill, MIT):
 * an LLM writes the script, then writes the video's shot list as canvas code against the
 * vendored engine; the app renders stills, sends errors and a contact sheet back, and the
 * model fixes the code. Everything else (voice, timing, captions, music, export) is the
 * app's normal pipeline.
 */

/* ------------------------------------------------------------------ */
/* Script                                                              */
/* ------------------------------------------------------------------ */

export const STICK_SCRIPT_SYSTEM = `You write voiceovers for short vertical cartoon explainer reels (TikTok / Reels / Shorts) animated with stick figures: a bright cartoon world, stick people with big white heads and expressive faces, constant camera motion, whip transitions, 1–3 word captions.

Writing rules:
- One idea per sentence; each scene is one sentence (two short ones at most). 8 to 15 scenes.
- Arc: a "what if" or surprising hook in action from the first second → the common belief → a turn ("But…") → examples that build → one scene that shows the mechanism → a payoff that answers the hook.
- Every scene must be easy to draw with stick figures and simple props (coins, jars, houses, cars, phones, charts, calendars, clocks, arrows, signs).
- Natural spoken rhythm in the target language, not a translation. No greetings, no "in this video".
- Never invent statistics. Numbers are simple arithmetic you show or clearly framed hypotheses; hedge theories ("some economists think"). No financial advice.
- "visual": a one-line English shot idea for the animator (who, where, what moves, the camera). "characterAction", "camera", "animation", "sfx": short English notes.
- "emphasis": the key word(s) of the line; "negative": words for losses or risks (often empty).`;

export function stickScriptPrompt(req: ScriptRequest, feedback?: string[]): string {
  return [
    `Topic: ${req.options.topic}`,
    `Language: ${LANGUAGE_LABELS[req.options.language]} (${req.options.language}). Write everything spoken in this language.`,
    `Target length: about ${req.targetSeconds} seconds of narration, ${req.wordRange[0]}–${req.wordRange[1]} spoken words in total.`,
    'isHypothetical = true when the story is a scenario; list its assumptions. claims: only verifiable facts with a source, otherwise hypotheses.',
    'The first scene narration must start with the hook. The last scene narration must contain the final line.',
    feedback?.length ? `\nYour previous attempt was rejected for these reasons — fix all of them:\n- ${feedback.join('\n- ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Storyboard placeholders: the real direction is the shot code written later. */
export function stickStoryboard(script: Script): Storyboard {
  const scenes: StoryboardScene[] = script.scenes.map((s, i) => ({
    id: `s${String(i + 1).padStart(2, '0')}`,
    narration: s.narration,
    emphasis: s.emphasis,
    negative: s.negative,
    durationHint: s.durationHint,
    visualDescription: s.visual,
    character: { visible: false, pose: 'idle', expression: 'neutral', position: 'center', motion: 'none', facing: 'right' },
    background: 'black',
    props: [],
    effect: 'none',
    camera: 'static',
    transition: i === 0 ? 'cut' : 'cut',
    textOverlay: null,
    chart: null,
    sfx: [],
  }));
  return { version: 1, title: script.title, language: script.language, characterId: 'stick', scenes, illustrations: [] };
}

/* ------------------------------------------------------------------ */
/* Shot code                                                           */
/* ------------------------------------------------------------------ */

export const STICK_SHOTS_SYSTEM = `You are the animator of a 9:16 stick-figure explainer reel (1080×1920, 30 fps). You write its shot list as plain JavaScript against the canvas engine below. The app renders every frame by calling your draw functions; it adds the captions, the music, the voice and the whip transitions itself.

Output: one \`\`\`js code block and nothing else. The code:
- declares any helpers it needs (functions, constants, character presets), then calls SHOTS.push({ start, end, tr, draw(ctx, lt, t) { … } }) once per shot, in order.
- start / end are seconds of the voiceover (the timing table gives each scene's span and word times). Cover the whole video: from 0 to DURATION, no gaps. DURATION is a global number.
- tr is the transition OUT of the shot: 'whip' (fast pan with motion blur, the default) or 'cut'.
- draw(ctx, lt, t): lt = seconds since the shot started, t = seconds since the video started. The canvas is cleared to black before each call; save/restore your own state.
- Must be deterministic: no Math.random (use rng(seed)), no Date, no timers, no async.
- Pure drawing code only. These identifiers are rejected: import, require, eval, Function, constructor, prototype, globalThis, window, document, ownerDocument, fetch, XMLHttpRequest, WebSocket, Worker, navigator, location, localStorage, indexedDB, postMessage, setTimeout, setInterval, requestAnimationFrame, Reflect, Proxy, WebAssembly, process, Image, OffscreenCanvas, createElement — also inside comments and strings.
- Available globals: everything defined in the engine (drawStick, POSE, PAL, kf, ease, easeOut, backOut, lerp, inv, clamp, shake, rng, circle, ellipse, rrect, path, line, fillStroke, text, burst, star5, puff, sweat, sparkle, drawSky, drawSun, drawCloud, drawSea, applyCam, darkness, lightShaft, drawCrate, drawBarrel, drawChest, ik, C, walkLegs, walkArms, handheld, W, H, FPS, INK, TAU…), plus SHOTS and DURATION.

Direction (the house style):
- About one setup every 2–4 s; a new idea gets a new setup. The hook starts in action on frame 1. One longer shot shows the mechanism.
- Bright saturated palette, ink outlines (INK), soft contact shadows, slow push-ins with handheld drift (handheld(t)), an impact is a burst + shake + flash.
- Stick people: drawStick(ctx, { x, y, s, flip, cols: PAL.red|blue|yellow|green|navy|purple, hat, arms, legs, face: { eyes, mouth, look, blink, brow… }, bob, lean, squash, alpha, sil }). y is the feet. Faces: eyes normal|wide|squint|happy|half|smug|spiral|x, mouth smile|grin|smirk|o|flat|frown|teeth. Use C(preset, overrides) to vary a preset. arms/legs take angle pairs or { ik: [x, y] } targets (see POSE and the example).
- Draw the props the story needs yourself with the primitives (coins, jars, houses, phones, charts, arrows, signs…). Short labels with text() are fine; no long text on screen.
- Safe area: keep faces, key props and labels inside x 100–980, y 220–1500. Keep the caption band y 1250–1420 free of faces and key props (backgrounds may pass behind it).
- Match each shot to what the voice says at that moment (use the word times).

The engine (vendored from claude-animation-skills, MIT):
\`\`\`js
${STICK_ENGINE_SOURCE}
\`\`\`

A complete example reel written for this engine (a pirate story; reuse its techniques, not its world — its own helpers such as YOU, PATCH or deckBG are not available unless you define them):
\`\`\`js
${STICK_EXAMPLE_SHOTS}
\`\`\``;

export interface StickTiming {
  duration: number;
  scenes: Array<{ index: number; start: number; end: number; narration: string; visual: string; words: Array<{ w: string; t: number }> }>;
}

export function stickTiming(scenes: PlannedScene[], narration: NarrationManifest, fps: number, durationInFrames: number, script: Script): StickTiming {
  const bySceneId = new Map(narration.segments.map((s) => [s.sceneId, s]));
  return {
    duration: durationInFrames / fps,
    scenes: scenes.map((sc, i) => {
      const seg = bySceneId.get(sc.id);
      return {
        index: i + 1,
        start: sc.startFrame / fps,
        end: (sc.startFrame + sc.durationInFrames) / fps,
        narration: sc.narration,
        visual: script.scenes[i]?.visual ?? '',
        words: seg ? seg.words.map((w) => ({ w: w.text, t: Math.round((seg.start + w.start) * 100) / 100 })) : [],
      };
    }),
  };
}

export function stickShotsPrompt(script: Script, timing: StickTiming): string {
  const table = timing.scenes
    .map((s) => `Scene ${s.index}  ${s.start.toFixed(2)}–${s.end.toFixed(2)} s\n  voice: ${s.narration}\n  shot idea: ${s.visual || '(free)'}\n  words: ${s.words.map((w) => `${w.w}@${w.t.toFixed(2)}`).join(' ')}`)
    .join('\n');
  return [
    `Reel: "${script.title}" (${LANGUAGE_LABELS[script.language]} voiceover). DURATION = ${timing.duration.toFixed(2)} s.`,
    'Timing table (seconds of the final video):',
    table,
    'Write the complete shot list now: one ```js block.',
  ].join('\n\n');
}

export function extractCode(text: string): string | null {
  const blocks = [...text.matchAll(/```(?:js|javascript)?\s*\n([\s\S]*?)```/g)].map((m) => m[1]!.trim());
  if (blocks.length) return blocks.sort((a, b) => b.length - a.length)[0]!;
  return /SHOTS\.push\s*\(/.test(text) ? text.trim() : null;
}

/** What the writer needs from the app: an LLM that can write code, and a way to test the code. */
export interface StickWriterDeps {
  writeText: (req: TextRequest, ctx: ProviderContext, useCache?: boolean) => Promise<string>;
  /** Render sample frames with the code in strict mode: an error message, or a contact sheet (JPEG) and the sampled times. */
  test: (code: string) => Promise<{ error: string } | { sheet: Buffer; times: number[] }>;
  report: (fraction: number, message: string) => void;
  warn: (message: string) => void;
}

export interface StickWriteResult {
  code: string;
  rounds: number;
  reviewed: boolean;
}

/**
 * Write → test → (fix) → visual review → (fix). At most 4 model calls; a version that
 * renders without errors is always kept, so a failed review never loses a working reel.
 */
export async function writeStickShots(script: Script, timing: StickTiming, deps: StickWriterDeps, ctx: ProviderContext, maxCalls = 4): Promise<StickWriteResult> {
  const base: TextRequest = { name: 'stick-shots', system: STICK_SHOTS_SYSTEM, prompt: stickShotsPrompt(script, timing) };
  let calls = 0;
  let rounds = 0;
  let working: string | null = null;
  let sheet: { sheet: Buffer; times: number[] } | null = null;

  deps.report(0.05, 'Claude is writing the animation (a few minutes)…');
  let text = await deps.writeText(base, ctx, true);
  calls++;
  let code = extractCode(text);
  let feedback: string | null = null;
  // Fix loop: static checks and render errors go back to the model with the code.
  while (calls <= maxCalls) {
    throwIfAborted(ctx.signal);
    rounds++;
    if (!code) feedback = 'Your answer contained no ```js code block with SHOTS.push calls.';
    else {
      const issues = checkStickCode(code);
      if (issues.length) feedback = issues.join(' ');
      else {
        deps.report(0.35 + 0.1 * rounds, 'Checking the animation frame by frame…');
        const res = await deps.test(code);
        if ('error' in res) feedback = `Rendering failed: ${res.error}`;
        else {
          working = code;
          sheet = res;
          break;
        }
      }
    }
    if (calls >= maxCalls) break;
    deps.report(0.4 + 0.1 * rounds, 'Claude is fixing the animation…');
    text = await deps.writeText({ ...base, prompt: `${base.prompt}\n\nYour previous shot list:\n\`\`\`js\n${code ?? text.slice(0, 20000)}\n\`\`\`\n\nIt was rejected: ${feedback}\nReturn the complete corrected shot list as one \`\`\`js block.` }, ctx, false);
    calls++;
    code = extractCode(text);
  }
  if (!working || !sheet) throw new UserFacingError(`The animation could not be completed: ${feedback ?? 'no valid shot list'}. Retry the generation, or pick another category.`, true);

  // Visual review: the model looks at a contact sheet of its own frames once.
  if (calls < maxCalls) {
    deps.report(0.7, 'Claude is reviewing the frames…');
    const review = await deps.writeText(
      {
        ...base,
        prompt: `${base.prompt}\n\nYour shot list:\n\`\`\`js\n${working}\n\`\`\`\n\nThe image is a contact sheet of rendered frames, left to right, top to bottom, at t = ${sheet.times.map((t) => t.toFixed(1)).join(', ')} s (captions not shown; they sit at y≈1345). Check each frame against the voice at that time: empty or broken frames, figures cut off or outside the safe area, faces or key props inside the caption band y 1250–1420, unreadable labels, shots that don't show what is being said. If everything is fine, answer exactly OK. Otherwise return the complete corrected shot list as one \`\`\`js block.`,
        images: [{ data: sheet.sheet, mediaType: 'image/jpeg' }],
      },
      ctx,
      false,
    );
    calls++;
    const fixed = /^\s*OK\s*\.?\s*$/i.test(review) ? null : extractCode(review);
    if (fixed && fixed !== working) {
      const issues = checkStickCode(fixed);
      const res = issues.length ? { error: issues.join(' ') } : await deps.test(fixed);
      if ('error' in res) deps.warn(`The reviewed animation failed (${res.error.slice(0, 160)}); the first working version was kept.`);
      else return { code: fixed, rounds: rounds + 1, reviewed: true };
    }
    return { code: working, rounds, reviewed: true };
  }
  return { code: working, rounds, reviewed: false };
}
