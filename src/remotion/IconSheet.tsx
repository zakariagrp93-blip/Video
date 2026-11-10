import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DEFAULT_THEME, PROP_ASSETS } from '../shared/constants';
import { ensureFonts, FONT_FAMILY } from './fonts';
import { PropIcon } from './props/icons';

ensureFonts();

/** Preview of the whole vector illustration library (Remotion Studio / visual QA). */
const TONES: Record<string, string> = { color: '', muted: 'saturate(0.45) brightness(1.06) contrast(1.04)', mono: 'grayscale(1) brightness(1.18) contrast(1.06)' };

export const IconSheet: React.FC<{ tone?: string }> = ({ tone = 'color' }) => (
  <AbsoluteFill style={{ backgroundColor: '#000', padding: 30, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 6 }}>
    {PROP_ASSETS.map((a) => (
      <div key={a} style={{ width: 168, height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ filter: TONES[tone] || undefined }}>
          <PropIcon asset={a} size={150} accent={DEFAULT_THEME.accent} />
        </div>
        <div style={{ fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 18, color: '#8E8E93', marginTop: 6 }}>{a}</div>
      </div>
    ))}
  </AbsoluteFill>
);
