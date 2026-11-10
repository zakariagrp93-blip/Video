# Third-party notices

## Google Noto Emoji (illustrations)

All 36 object illustrations (banknote, coins, money bag, bank, houses, cars, phone, credit card,
laptop, charts, clock, buildings, shop, piggy bank, calendar, gift, wallet, briefcase, receipt,
airplane, scroll, shopping bags, percent, lock, hourglass, hot beverage, boat, question/exclamation
marks, trophy, graduation cap) come from Google Noto Emoji, via the `@iconify-json/noto` package,
and are embedded in `src/remotion/props/fluent.generated.ts` (selection: `scripts/icon-picks.json`).

Copyright Google Inc. Licensed under the Apache License, Version 2.0 (the "License"); you may not
use these files except in compliance with the License. You may obtain a copy of the License at
https://www.apache.org/licenses/LICENSE-2.0 — Unless required by applicable law or agreed to in
writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific
language governing permissions and limitations under the License.

The icon picker (`scripts/build-icon-picker.mjs`) also offers Microsoft Fluent Emoji (MIT license,
Copyright (c) Microsoft Corporation); picking one of those sets for an asset embeds it under that
license.

## claude-animation-skills (animation styles)

The minimal self-drawing graph (`MinimalGraphView` in `src/remotion/Chart.tsx`) and the minimal
"steps" shot of motivation edits (`src/remotion/edit/motifs.tsx`) re-implement, in Remotion, the
look and timing of the `/graph` and `/minimalistic-graphics` skills from
https://github.com/artemnovitckii/claude-animation-skills.

MIT License — Copyright (c) 2026 Artem Novitckii. Permission is hereby granted, free of charge, to
any person obtaining a copy of this software and associated documentation files, to deal in the
Software without restriction, subject to including the copyright notice and this permission notice
in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT
WARRANTY OF ANY KIND.

## Other components

- Montserrat font — SIL Open Font License 1.1 (via `@fontsource/montserrat`).
- Piper voices — see the `MODEL_CARD` shipped with each downloaded voice.
- eSpeak-NG — GPL-3.0. FFmpeg / FFprobe binaries — GPL builds (`ffmpeg-static`, `ffprobe-static`).
- Remotion — Remotion License (free for individuals and companies up to 3 people).
