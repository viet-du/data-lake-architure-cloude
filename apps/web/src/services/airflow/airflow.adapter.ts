import { z } from 'zod';
import type { AirflowDAG, AirflowStats, AirflowDAGRun } from '@/types/entities';

export function decodeDAG(input: unknown): AirflowDAG {
  const v = z.object({ dagId: z.string(), isActive: z.boolean(), isPaused: z.boolean(), tags: z.array(z.string()),
    description: z.string().nullable(), scheduleInterval: z.string().nullable(),
  }).parse(input);
  return { dagId: v.dagId, isActive: v.isActive, isPaused: v.isPaused, tags: v.tags, status: 'unknown',
    ...(v.description ? { description: v.description } : {}), ...(v.scheduleInterval ? { scheduleInterval: v.scheduleInterval } : {}),
  };
}
export function decodeAirflowStats(input: unknown): AirflowStats {
  const v = z.object({ totalDags: z.number(), activeDags: z.number(), pausedDags: z.number(), runningRuns: z.number(), failedRuns: z.number(), successRuns: z.number(), queuedRuns: z.number() }).parse(input);
  return { totalDAGs: v.totalDags, activeDAGs: v.activeDags, pausedDAGs: v.pausedDags, runningRuns: v.runningRuns,
    totalRuns: v.runningRuns + v.failedRuns + v.successRuns + v.queuedRuns,
  };
}
export function decodeDAGRun(input: unknown): AirflowDAGRun {
  const v = z.object({ runId: z.string(), dagId: z.string(), executionDate: z.string(), state: z.enum(['success','failed','running','queued','skipped','up_for_retry','upstream_failed','planned','none']),
    startDate: z.string().nullable(), endDate: z.string().nullable(), runType: z.string(),
  }).parse(input);
  return { runId: v.runId, dagId: v.dagId, executionDate: v.executionDate, state: v.state,
    triggeredBy: v.runType === 'manual' ? 'manual' : v.runType === 'scheduled' ? 'schedule' : 'api',
    ...(v.startDate ? { startDate: v.startDate } : {}), ...(v.endDate ? { endDate: v.endDate } : {}),
  };
}
export function decodeAirflowItems(input: unknown): unknown[] {
  return z.object({ items: z.array(z.unknown()), total: z.number() }).parse(input).items;
}

const taskState = z.enum(['success', 'failed', 'running', 'queued', 'skipped', 'up_for_retry', 'upstream_failed', 'scheduled', 'deferred', 'removed', 'restarting', 'none']);
export function decodeTask(input: unknown) {
  const value = z.object({ taskId: z.string(), runId: z.string(), state: taskState, startDate: z.string().nullable(), endDate: z.string().nullable(), duration: z.number().nullable(), tryNumber: z.number(), operator: z.string() }).parse(input);
  return { taskId: value.taskId, runId: value.runId, state: value.state, tryNumber: value.tryNumber, operator: value.operator,
    ...(value.startDate ? { startDate: value.startDate } : {}), ...(value.endDate ? { endDate: value.endDate } : {}),
    ...(value.duration !== null ? { durationMs: value.duration * 1000 } : {}),
  };
}
export function decodeLogs(input: unknown) {
  const value = z.object({ taskId: z.string(), runId: z.string(), tryNumber: z.number(), content: z.string() }).parse(input);
  return { taskId: value.taskId, runId: value.runId, tryNumber: value.tryNumber, logs: value.content };
}
export function decodeGantt(input: unknown) {
  const values = z.object({ tasks: z.array(z.object({ taskId: z.string(), startDate: z.string().nullable(), duration: z.number().nullable(), state: taskState })) }).parse(input).tasks;
  const timed = values.flatMap((task) => task.startDate && task.duration !== null ? [{ ...task, start: Date.parse(task.startDate), duration: task.duration * 1000 }] : []);
  const start = Math.min(...timed.map((task) => task.start));
  return timed.map((task) => ({ taskId: task.taskId, state: task.state, startOffset: task.start - start, duration: task.duration }));
}
