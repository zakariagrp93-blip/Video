import type { AppDatabase } from '../db/database';
import type { Settings } from '../../shared/schemas';

export interface UsageRecord {
  projectId?: string;
  provider: string;
  kind: 'llm' | 'image' | 'tts';
  model?: string;
  /** Billing units: tokens for LLMs, images for image models, characters for TTS. */
  units: number;
  unitType: 'tokens' | 'images' | 'characters';
  inputTokens?: number;
  outputTokens?: number;
  cached?: boolean;
  ok?: boolean;
}

/**
 * Estimates a cost from user-configurable pricing. When the price for a
 * provider is unknown (0), the cost is `null` — the UI shows "unknown"
 * instead of inventing a number.
 */
export function estimateCost(rec: UsageRecord, pricing: Settings['pricing']): number | null {
  if (rec.cached || rec.ok === false) return 0;
  switch (`${rec.provider}:${rec.kind}`) {
    case 'anthropic:llm': {
      if (!pricing.anthropicInputPerMTok && !pricing.anthropicOutputPerMTok) return null;
      return ((rec.inputTokens ?? 0) * pricing.anthropicInputPerMTok + (rec.outputTokens ?? 0) * pricing.anthropicOutputPerMTok) / 1e6;
    }
    case 'openai:llm': {
      if (!pricing.openaiInputPerMTok && !pricing.openaiOutputPerMTok) return null;
      return ((rec.inputTokens ?? 0) * pricing.openaiInputPerMTok + (rec.outputTokens ?? 0) * pricing.openaiOutputPerMTok) / 1e6;
    }
    case 'openai:image':
      return pricing.openaiImagePerImage ? rec.units * pricing.openaiImagePerImage : null;
    case 'openai:tts':
      return pricing.openaiTtsPerMChar ? (rec.units * pricing.openaiTtsPerMChar) / 1e6 : null;
    case 'elevenlabs:tts':
      return pricing.elevenlabsPerMChar ? (rec.units * pricing.elevenlabsPerMChar) / 1e6 : null;
    default:
      // Local providers (offline LLM engine, vector images, Piper TTS) cost nothing.
      return 0;
  }
}

export class CostTracker {
  constructor(
    private readonly db: AppDatabase,
    private readonly getPricing: () => Settings['pricing'],
  ) {}

  record(rec: UsageRecord): number | null {
    const cost = estimateCost(rec, this.getPricing());
    this.db.run(
      `INSERT INTO api_requests (project_id, provider, kind, model, units, unit_type, input_tokens, output_tokens, cost_usd, cached, ok, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rec.projectId ?? null,
        rec.provider,
        rec.kind,
        rec.model ?? null,
        rec.units,
        rec.unitType,
        rec.inputTokens ?? null,
        rec.outputTokens ?? null,
        cost,
        rec.cached ? 1 : 0,
        rec.ok === false ? 0 : 1,
        new Date().toISOString(),
      ],
    );
    return cost;
  }

  projectCost(projectId: string): { usd: number; known: boolean; requests: number; cachedHits: number } {
    const rows = this.db.all<{ cost_usd: number | null; cached: number }>(
      'SELECT cost_usd, cached FROM api_requests WHERE project_id = ?',
      [projectId],
    );
    let usd = 0;
    let known = true;
    let cachedHits = 0;
    for (const r of rows) {
      if (r.cost_usd === null) known = false;
      else usd += r.cost_usd;
      if (r.cached) cachedHits += 1;
    }
    return { usd, known, requests: rows.length, cachedHits };
  }

  requestsFor(projectId: string): Array<Record<string, unknown>> {
    return this.db.all('SELECT * FROM api_requests WHERE project_id = ? ORDER BY id', [projectId]);
  }

  totals(): { usd: number; requests: number; unknownCount: number } {
    const row = this.db.get<{ usd: number | null; n: number; unknown: number }>(
      'SELECT SUM(cost_usd) AS usd, COUNT(*) AS n, SUM(CASE WHEN cost_usd IS NULL THEN 1 ELSE 0 END) AS unknown FROM api_requests',
    );
    return { usd: row?.usd ?? 0, requests: row?.n ?? 0, unknownCount: row?.unknown ?? 0 };
  }
}
