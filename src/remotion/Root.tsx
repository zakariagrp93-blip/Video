import React from 'react';
import { Composition } from 'remotion';
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from '../shared/constants';
import { CharacterSheet } from './CharacterSheet';
import { FinanceVideo, type FinanceVideoProps } from './FinanceVideo';
import { IconSheet } from './IconSheet';
import { samplePlan } from './samplePlan';

export const COMPOSITION_ID = 'FinanceVideo';

export const RemotionRoot: React.FC = () => (
  <>
  <Composition id="CharacterSheet" component={CharacterSheet} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} fps={VIDEO_FPS} durationInFrames={1} />
  <Composition
    id="CinemaPreview"
    component={FinanceVideo}
    width={VIDEO_WIDTH}
    height={VIDEO_HEIGHT}
    fps={VIDEO_FPS}
    durationInFrames={samplePlan(14, 2, 'cinema').durationInFrames}
    defaultProps={{ plan: samplePlan(14, 2, 'cinema') } satisfies FinanceVideoProps}
  />
  <Composition id="IconSheet" component={IconSheet} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} fps={VIDEO_FPS} durationInFrames={1} />
  <Composition
    id={COMPOSITION_ID}
    component={FinanceVideo}
    width={VIDEO_WIDTH}
    height={VIDEO_HEIGHT}
    fps={VIDEO_FPS}
    durationInFrames={samplePlan().durationInFrames}
    defaultProps={{ plan: samplePlan() } satisfies FinanceVideoProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: props.plan.durationInFrames,
      fps: props.plan.fps,
      width: props.plan.width,
      height: props.plan.height,
    })}
  />
  </>
);
