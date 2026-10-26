import type { DashboardStageState } from '@/types/entities';
import type { EPipelineNodeKind } from './schematic.types';

/**
 * The Schematic's live overlay.
 *
 * The schematic is a 3D illustration of the pipeline; the overlay puts the
 * *real* state on top of it. The rule that keeps this honest:
 *
 *  * the overlay is a **projection of the Home read model**, never a second
 *    source. Every number it shows came from `GET /api/dashboard/summary`,
 *    so the schematic can never disagree with the cards next to it; and
 *  * a missing measurement renders as `—`, not `0`. A node with no
 *    operation is "idle", which is a different fact from "0 records".
 *
 * The stage of a node is not always the node's own kind — the `catalog`
 * node is fed by `silver` and `gold`, and the `dq` stage is not a node of
 * its own. `STAGE_FOR_NODE` makes those relationships explicit instead of
 * leaving them implicit in the component.
 */

/** The node whose live state is shown by a given pipeline stage. */
const STAGE_FOR_NODE: Readonly<Record<EPipelineNodeKind, string>> = {
  crawler: 'crawler',
  bronze: 'bronze',
  silver: 'silver',
  gold: 'gold',
  catalog: 'catalog',
  storage: 'storage',
};

/**
 * The stage whose state is shown on a node.
 *
 * The catalog is populated by the Silver and Gold stages, so its state is
 * the *union* of the two — and the DQ outcome is surfaced on every node
 * because a quality gate applies to the whole pipeline.
 */
export function stageForNode(kind: EPipelineNodeKind): string {
  return STAGE_FOR_NODE[kind];
}

export interface SchematicOverlay {
  /** The number of operations of this node's stage that are running. */
  running: number;
  /** The last operation of this node's stage, when there is one. */
  lastOperation: DashboardStageState['lastOperation'];
  /** The quality pass rate, or `null` when nothing was evaluated. */
  qualityPassRate: number | null;
  /** True when the overlay could not be read at all. */
  unavailable: boolean;
}

/**
 * The overlay of one node.
 *
 * `stageStates` may be empty (the summary failed) or may not contain this
 * node's stage (the stage has never run). Both cases render as "no live
 * information" rather than as zeros.
 */
export function overlayForNode(
  kind: EPipelineNodeKind,
  stageStates: ReadonlyArray<DashboardStageState>,
  unavailable: boolean,
): SchematicOverlay {
  const stage = stageForNode(kind);
  const state = stageStates.find((candidate) => candidate.stage === stage);

  if (unavailable || state === undefined) {
    return {
      running: 0,
      lastOperation: null,
      qualityPassRate: null,
      unavailable: true,
    };
  }

  return {
    running: state.running,
    lastOperation: state.lastOperation,
    // The quality pass rate is a property of the DQ ledger, so it is shown
    // on every node — but only the DQ node reports it in the read model, so
    // the overlay reads it from there.
    qualityPassRate: state.quality.passRate,
    unavailable: false,
  };
}

/**
 * The quality pass rate of the whole pipeline.
 *
 * It comes from the DQ stage, because that is the only stage that carries
 * a quality measurement. `null` means "not evaluated" — never 0%.
 */
export function pipelineQuality(
  stageStates: ReadonlyArray<DashboardStageState>,
): number | null {
  const dq = stageStates.find((candidate) => candidate.stage === 'dq');
  return dq?.quality.passRate ?? null;
}

/**
 * The health of a node, derived from its live state.
 *
 * `idle` — the stage has never run.
 * `running` — work is in flight right now.
 * `healthy` — the last operation succeeded.
 * `degraded` — the last operation failed or was cancelled.
 */
export type ESchematicNodeHealth = 'idle' | 'running' | 'healthy' | 'degraded';

export function nodeHealth(overlay: SchematicOverlay): ESchematicNodeHealth {
  if (overlay.unavailable) return 'idle';
  if (overlay.running > 0) return 'running';

  const status = overlay.lastOperation?.status;
  if (status === undefined) return 'idle';
  if (status === 'succeeded') return 'healthy';
  if (status === 'failed' || status === 'cancelled' || status === 'partial') {
    return 'degraded';
  }
  // `queued` and `running` are in flight but not yet committed.
  if (status === 'queued' || status === 'running') return 'running';
  return 'idle';
}
