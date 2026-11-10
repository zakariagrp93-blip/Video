# Stick-figure engine (vendored)

`lib.js`, `chars.js`, `env.js` and `example-shots.js` come unchanged from
https://github.com/artemnovitckii/claude-animation-skills (`skills/stick-figure/engine/template/web/`),
MIT License © 2026 Artem Novitckii (see `LICENSE`).

`scripts/gen-stick-engine.mjs` turns them into `src/shared/stickEngine.generated.ts`:
- the engine source the Remotion composition evaluates, and
- the same text, plus the example shot list, that is sent to Claude as the API reference
  when it writes a video's shots.
