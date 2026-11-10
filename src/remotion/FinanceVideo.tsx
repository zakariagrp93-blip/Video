import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VideoPlan } from '../shared/schemas';
import { Captions } from './Captions';
import { ensureFonts, FONT_FAMILY } from './fonts';
import { SceneView } from './SceneView';

export interface FinanceVideoProps {
  plan: VideoPlan;
  [key: string]: unknown;
}

ensureFonts();

export const FinanceVideo: React.FC<FinanceVideoProps> = ({ plan }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const speaking = useMemo(() => {
    const ranges: Array<[number, number]> = [];
    for (const c of plan.captions) for (const w of c.words) ranges.push([w.startFrame, w.endFrame]);
    return (f: number) => ranges.some(([a, b]) => f >= a && f < b);
  }, [plan.captions]);

  return (
    <AbsoluteFill style={{ backgroundColor: plan.theme.background }}>
      {plan.scenes.map((sc, i) => (
        <Sequence key={sc.id} from={sc.startFrame} durationInFrames={sc.durationInFrames} name={`${sc.id}`}>
          <SceneFrame plan={plan} index={i} speaking={speaking} fps={fps} />
        </Sequence>
      ))}
      <Captions cues={plan.captions} frame={frame} fps={fps} accent={plan.theme.accent} danger={plan.theme.danger} />
      {plan.brandName && (
        <div style={{ position: 'absolute', left: 70, top: 190, fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 38, color: plan.theme.accent, letterSpacing: 1, opacity: 0.9 }}>@{plan.brandName}</div>
      )}
    </AbsoluteFill>
  );
};

const SceneFrame: React.FC<{ plan: VideoPlan; index: number; speaking: (f: number) => boolean; fps: number }> = ({ plan, index, speaking, fps }) => {
  const frame = useCurrentFrame();
  const scene = plan.scenes[index]!;
  const next = plan.scenes[index + 1];
  return <SceneView scene={scene} nextTransition={next ? next.transition : null} frame={frame} fps={fps} theme={plan.theme} lang={plan.language} images={plan.images} talking={speaking} />;
};
