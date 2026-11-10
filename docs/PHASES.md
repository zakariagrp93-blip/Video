# Development log: phases and verification

Each phase was verified before the next one started. The commands below re-run the same checks.

## Phase 1: Environment inspection
- Node 22.23, npm 10.9, FFmpeg 6.1 (libx264, AAC), Chromium available, 4 CPUs, 15 GB RAM.
- No AI API keys present, so the default stack had to work offline with real providers: an offline story engine, Piper voices and a vector library.
- The Piper executable could not be used in this sandbox, so Piper voices run in Node through ONNX Runtime with eSpeak-NG compiled to WebAssembly. This is cross-platform, so Windows needs no extra binary.

## Phase 2: Structure and dependencies
- Electron + React + TypeScript + Vite, Remotion 4.0.542, sql.js, zod, the official Anthropic and OpenAI SDKs, ffmpeg-static and ffprobe-static.
- Modular layout: `electron/`, `src/renderer`, `src/shared`, `src/core/*` (providers, script, storyboard, characters, audio, subtitles, timing, render, pipeline, storage) and `src/remotion`.

## Phase 3: Desktop interface
- Dashboard, Generator (with live pre-flight), Progress, Library and Settings.
- Verified by `tests/e2e/ui.e2e.mjs`. It launches the real Electron app, uses every screen, generates a video through the UI and plays it in the in-app player at 1080×1920. It also checks that API keys never reach the DOM and refuses plain-text storage when no OS keyring is available. Voice download, duplicate and delete are covered too.

## Phase 4: Script and storyboard engines
- Structured JSON with zod validation, content validation (length, hook, filler phrases, unsourced facts, language), bounded regeneration with feedback, deterministic storyboard repairs, a rule-based fallback director, and LLM scene review.
- Verified by `tests/unit/offlineEngine.test.ts` (5 topics × 2 languages × 5 durations) and `tests/unit/validation.test.ts`.

## Phase 5: Characters and illustrations
- The original mascot "Nummo" has 14 poses × 10 expressions and is exported as reusable SVGs plus a reference sheet. The 36 vector props are exported per project. AI illustrations are optional, capped and cached.
- Verified with rendered pose sheets, `render.test.ts` (non-blank composition, character sheet) and the e2e project folder checks.

## Phase 6: TTS and subtitles
- Piper (local), ElevenLabs (char timestamps) and OpenAI. Narration is synthesized sentence by sentence; scene timing comes from the measured audio; alignment is pause-anchored.
- Verified by `tests/unit/tts.test.ts` (real French synthesis, cache, speed, pause detection), `timing.test.ts` and `providers.test.ts`.

## Phase 7: Remotion animations
- A reusable animation library (props, camera, character motion, transitions, effects, charts, counters, captions) with consistent easing.
- Verified with visual contact sheets of every pose and of the generated videos.

## Phase 8: Rendering
- Per-scene H.264 chunks cached by content hash, a lossless concat, an AAC mux at −14 LUFS, and validation (codec, 1080×1920, 30 fps, yuv420p, duration, full decode).
- Verified by `render.test.ts`: only changed scenes re-render, and bad files are rejected.
- Issues found and fixed during verification: the chunks were full-range `yuvj420p` and are now bt709 limited range. A Remotion browser-check promise could get stuck after a bad path; the path is now validated first.

## Phase 9: Automatic pipeline
- Eight stages with checkpoints, retries, cancellation, real progress and ETA, a queue, and crash recovery.
- Verified by `tests/e2e/pipeline.test.ts`: a complete 30 s video, cancel then resume (finished stages and scenes reused), and renderer failure then recovery.

## Phase 10: Full application test
- 73 unit tests, 7 e2e tests, the UI e2e (dev tree and packaged app), and the reference video "Et si tu recevais 1 million d'euros à 18 ans ?" (60.8 s, −14 LUFS, H.264/AAC 1080×1920 at 30 fps). Its frames were inspected and composition fixes applied: mascot scale, prop slots, trophy placement.

## Phase 11: Windows installer
- `npm run dist:win` builds `release/Finance-Video-Studio-Setup-1.0.0.exe` (NSIS, x64). It was cross-built from Linux with Wine.
- The packaging configuration was validated by running the UI e2e against a packaged build. This caught and fixed a missing `bundle.js.map` in the shipped resources.
- `.github/workflows/windows.yml` runs everything on `windows-latest`.
