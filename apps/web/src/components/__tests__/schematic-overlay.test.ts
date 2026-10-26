import { describe, expect, it } from 'vitest';
import {
  nodeHealth,
  overlayForNode,
  pipelineQuality,
  stageForNode,
} from '../schematic/schematic.overlay';
import type { DashboardStageState } from '@/types/entities';

/**
 * The Schematic overlay's mapping.
 *
 * The overlay puts the real state of the pipeline on top of the 3D
 * illustration. Two rules make it trustworthy:
 *
 *  * it is a projection of the Home read model — the same numbers, never a
 *    second source; and
 *  * a missing measurement is "no information", never a zero.
 */

function stage(
  name: string,
  overrides: Partial<DashboardStageState> = {},
): DashboardStageState {
  return {
    stage: name,
    running: 0,
    lastOperation: null,
    quality: { passRate: null, asOf: null },
    ...overrides,
  };
}

describe('schematic overlay', () => {
  describe('stageForNode', () => {
    it('maps every node to its own stage', () => {
      expect(stageForNode('bronze')).toBe('bronze');
      expect(stageForNode('silver')).toBe('silver');
      expect(stageForNode('gold')).toBe('gold');
      expect(stageForNode('crawler')).toBe('crawler');
      expect(stageForNode('catalog')).toBe('catalog');
      expect(stageForNode('storage')).toBe('storage');
    });
  });

  describe('overlayForNode', () => {
    it('reads the live state of the node’s stage', () => {
      const stages = [
        stage('bronze', {
          running: 2,
          lastOperation: {
            id: 'op_1',
            kind: 'bronze.ingest',
            status: 'succeeded',
            at: '2026-10-25T06:00:00.000Z',
          },
        }),
      ];

      const overlay = overlayForNode('bronze', stages, false);
      expect(overlay.running).toBe(2);
      expect(overlay.lastOperation?.id).toBe('op_1');
      expect(overlay.unavailable).toBe(false);
    });

    it('reports "no information" for a stage that never ran', () => {
      const overlay = overlayForNode('bronze', [], false);
      expect(overlay.running).toBe(0);
      expect(overlay.lastOperation).toBeNull();
      expect(overlay.qualityPassRate).toBeNull();
      // The stage is *absent*, not empty — the overlay says so.
      expect(overlay.unavailable).toBe(true);
    });

    it('reports "no information" when the whole read model failed', () => {
      const overlay = overlayForNode(
        'bronze',
        [stage('bronze', { running: 3 })],
        true,
      );
      // The summary failed — the numbers we happen to have are not
      // trustworthy, so the overlay does not claim them.
      expect(overlay.running).toBe(0);
      expect(overlay.unavailable).toBe(true);
    });

    it('does not leak another stage’s quality figure', () => {
      const stages = [stage('dq', { quality: { passRate: 87, asOf: 'now' } })];
      // The DQ stage is not a node of the schematic, so no node's overlay
      // carries its quality figure — the pipeline-level figure is read
      // through `pipelineQuality` instead.
      expect(overlayForNode('bronze', stages, false).qualityPassRate).toBeNull();
      expect(overlayForNode('silver', stages, false).qualityPassRate).toBeNull();
      expect(pipelineQuality(stages)).toBe(87);
    });
  });

  describe('pipelineQuality', () => {
    it('reads the quality figure from the DQ stage', () => {
      const stages = [
        stage('bronze'),
        stage('dq', { quality: { passRate: 92, asOf: '2026-10-25T06:00:00.000Z' } }),
      ];
      expect(pipelineQuality(stages)).toBe(92);
    });

    it('is null when nothing was evaluated — never a fake 0%', () => {
      expect(pipelineQuality([stage('dq')])).toBeNull();
      expect(pipelineQuality([])).toBeNull();
    });
  });

  describe('nodeHealth', () => {
    it('is "running" while work is in flight', () => {
      const overlay = overlayForNode(
        'bronze',
        [stage('bronze', { running: 1 })],
        false,
      );
      expect(nodeHealth(overlay)).toBe('running');
    });

    it('is "healthy" after the last operation succeeded', () => {
      const overlay = overlayForNode(
        'bronze',
        [
          stage('bronze', {
            lastOperation: {
              id: 'op_1',
              kind: 'bronze.ingest',
              status: 'succeeded',
              at: 'now',
            },
          }),
        ],
        false,
      );
      expect(nodeHealth(overlay)).toBe('healthy');
    });

    it('is "degraded" after the last operation failed', () => {
      const overlay = overlayForNode(
        'bronze',
        [
          stage('bronze', {
            lastOperation: {
              id: 'op_1',
              kind: 'bronze.ingest',
              status: 'failed',
              at: 'now',
            },
          }),
        ],
        false,
      );
      expect(nodeHealth(overlay)).toBe('degraded');
    });

    it('is "idle" when the stage never ran', () => {
      expect(nodeHealth(overlayForNode('bronze', [], false))).toBe('idle');
    });

    it('prefers "running" over the previous outcome', () => {
      // A stage whose last operation failed but which has work in flight
      // right now is running — the failure is in the history, not the state.
      const overlay = overlayForNode(
        'bronze',
        [
          stage('bronze', {
            running: 1,
            lastOperation: {
              id: 'op_1',
              kind: 'bronze.ingest',
              status: 'failed',
              at: 'now',
            },
          }),
        ],
        false,
      );
      expect(nodeHealth(overlay)).toBe('running');
    });
  });
});
