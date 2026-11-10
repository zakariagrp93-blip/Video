import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DEFAULT_THEME, POSES } from '../shared/constants';
import { ensureFonts, FONT_FAMILY } from './fonts';
import { Mascot } from './Mascot';

ensureFonts();

/** Reference sheet of the mascot (used as the reference image for AI providers that support it). */
export const CharacterSheet: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#000', padding: 40, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 10 }}>
    <div style={{ width: '100%', textAlign: 'center', fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 64, color: DEFAULT_THEME.foreground, marginBottom: 10 }}>NUMMO — character sheet</div>
    {POSES.map((pose) => (
      <div key={pose} style={{ width: 320, height: 380, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 40, top: 0, width: 240, height: 340 }}>
          <Mascot pose={pose} expression={pose === 'sad' ? 'sad' : pose === 'shocked' ? 'shocked' : pose === 'happy' || pose === 'celebrating' ? 'happy' : 'neutral'} frame={10} fps={30} />
        </div>
        <div style={{ position: 'absolute', bottom: 0, width: '100%', textAlign: 'center', fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 30, color: DEFAULT_THEME.accent }}>{pose}</div>
      </div>
    ))}
  </AbsoluteFill>
);
