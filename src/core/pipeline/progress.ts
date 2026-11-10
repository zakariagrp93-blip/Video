import { PIPELINE_STAGES, PIPELINE_STAGE_WEIGHTS, type PipelineStage, type ProjectStatus } from '../../shared/constants';

export interface ProgressEvent {
  projectId: string;
  status: ProjectStatus;
  stage: PipelineStage | null;
  stageIndex: number;
  /** 0..1 within the current stage — only advanced by real work callbacks. */
  stageProgress: number;
  /** 0..1 overall, weighted by typical stage cost. */
  overall: number;
  message: string;
  scene?: { index: number; total: number };
  /** Seconds remaining, when it can be estimated from measured throughput (render), else null. */
  etaSec: number | null;
  error?: { stage: PipelineStage; message: string; retryable: boolean };
  warnings?: string[];
}

const TOTAL_WEIGHT = PIPELINE_STAGES.reduce((a, s) => a + PIPELINE_STAGE_WEIGHTS[s], 0);

export function overallProgress(stage: PipelineStage, stageProgress: number): number {
  let acc = 0;
  for (const s of PIPELINE_STAGES) {
    if (s === stage) return (acc + PIPELINE_STAGE_WEIGHTS[s] * Math.max(0, Math.min(1, stageProgress))) / TOTAL_WEIGHT;
    acc += PIPELINE_STAGE_WEIGHTS[s];
  }
  return 1;
}

/** Throughput-based ETA: measures real progress over time, no guessing before data exists. */
export class EtaEstimator {
  private samples: Array<{ t: number; done: number }> = [];

  constructor(private readonly total: number) {}

  update(done: number, now = Date.now()): number | null {
    this.samples.push({ t: now, done });
    if (this.samples.length > 40) this.samples.shift();
    const first = this.samples[0]!;
    const last = this.samples[this.samples.length - 1]!;
    const dt = (last.t - first.t) / 1000;
    const dd = last.done - first.done;
    if (dt < 2 || dd <= 0) return null;
    return Math.max(0, (this.total - done) / (dd / dt));
  }
}
