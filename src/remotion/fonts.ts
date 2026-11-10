import { continueRender, delayRender } from 'remotion';
import m600 from '@fontsource/montserrat/files/montserrat-latin-600-normal.woff2';
import m800 from '@fontsource/montserrat/files/montserrat-latin-800-normal.woff2';
import m900 from '@fontsource/montserrat/files/montserrat-latin-900-normal.woff2';
import e800 from '@fontsource/montserrat/files/montserrat-latin-ext-800-normal.woff2';
import e900 from '@fontsource/montserrat/files/montserrat-latin-ext-900-normal.woff2';

/** Montserrat (SIL Open Font License) bundled from @fontsource — no network needed at render time. */
export const FONT_FAMILY = 'FVS Montserrat, Arial Black, Arial, sans-serif';

let loaded = false;
export function ensureFonts(): void {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const handle = delayRender('Loading fonts');
  const LATIN_EXT = 'U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
  const faces = [
    new FontFace('FVS Montserrat', `url(${m600})`, { weight: '600' }),
    new FontFace('FVS Montserrat', `url(${m800})`, { weight: '800' }),
    new FontFace('FVS Montserrat', `url(${m900})`, { weight: '900' }),
    new FontFace('FVS Montserrat', `url(${e800})`, { weight: '800', unicodeRange: LATIN_EXT }),
    new FontFace('FVS Montserrat', `url(${e900})`, { weight: '900', unicodeRange: LATIN_EXT }),
  ];
  Promise.all(faces.map((f) => f.load()))
    .then((fs) => {
      for (const f of fs) document.fonts.add(f);
      continueRender(handle);
    })
    .catch((err) => {
      console.error('Font loading failed', err);
      continueRender(handle);
    });
}
