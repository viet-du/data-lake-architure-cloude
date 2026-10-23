import { z } from 'zod';
import type { DQRule, DQRun, DQSummary } from '@/types/entities';

const ruleSchema = z.object({
  ruleId: z.string(), name: z.string(), type: z.enum(['null_check','range_check','in_set','unique','regex','custom_sql']),
  table: z.string(), column: z.string().nullable(), params: z.record(z.unknown()),
  severity: z.enum(['low','medium','high','critical']), enabled: z.boolean(),
  description: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
});
export function decodeRule(input: unknown): DQRule {
  const v = ruleSchema.parse(input);
  return { ...v, ruleName: v.name, tableName: v.table,
    ruleType: v.type === 'null_check' ? 'not_null' : v.type === 'range_check' ? 'range' : v.type === 'custom_sql' ? 'custom' : v.type,
    expression: JSON.stringify(v.params), status: 'unknown',
    ...(v.column ? { columnName: v.column } : {}), ...(v.description ? { description: v.description } : { description: undefined }),
  };
}
export function decodeRun(input: unknown): DQRun {
  const v = z.object({ runId: z.string(), ruleId: z.string().nullable(), status: z.enum(['pass','fail','error']),
    startedAt: z.string(), finishedAt: z.string(), durationMs: z.number(), totalRows: z.number(), errorMessage: z.string().nullable(),
  }).parse(input);
  return { runId: v.runId, status: v.status === 'pass' ? 'success' : 'failed',
    startedAt: v.startedAt, finishedAt: v.finishedAt, durationMs: v.durationMs,
    passedRules: v.status === 'pass' ? 1 : 0, failedRules: v.status === 'pass' ? 0 : 1,
    warningRules: 0, totalCheckedRows: v.totalRows,
    ...(v.ruleId ? { ruleId: v.ruleId } : {}), ...(v.errorMessage ? { errorMessage: v.errorMessage } : {}),
  };
}
export function decodeSummary(input: unknown): DQSummary {
  const v = z.object({ totalRules: z.number(), totalRuns: z.number(), passRate: z.number(),
    byStatus: z.array(z.object({ status: z.enum(['pass','fail','error']), count: z.number() })),
    recentRuns: z.array(z.object({ startedAt: z.string() })),
  }).parse(input);
  const passing = v.byStatus.find((s) => s.status === 'pass')?.count ?? 0;
  const failing = v.byStatus.filter((s) => s.status !== 'pass').reduce((sum, s) => sum + s.count, 0);
  return { totalRules: v.totalRules, passing, failing, passRate: v.totalRuns ? Math.round(v.passRate * 100) : null,
    overallStatus: v.totalRuns === 0 ? 'unknown' : failing > 0 ? 'unhealthy' : 'healthy',
    ...(v.recentRuns[0] ? { lastRunAt: v.recentRuns[0].startedAt } : {}),
  };
}
export function decodeItems(input: unknown): unknown[] {
  return z.object({ items: z.array(z.unknown()), total: z.number() }).parse(input).items;
}
