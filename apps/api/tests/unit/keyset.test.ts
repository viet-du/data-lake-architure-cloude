import { describe, it, expect } from 'vitest';
import {
  AUDIT_EVENT_PREFIX,
  OPERATION_EVENT_PREFIX,
  eventPrefix,
  sourceBoundary,
} from '@/lib/pagination';

/**
 * The keyset boundary derivation.
 *
 * The activity feed merges two collections, so the cursor has to be
 * translated into a boundary that each source can push down. The failure
 * mode this guards against is *silent event loss* at a page boundary — an
 * event that is neither re-read nor re-shown is gone, and nothing in the
 * response would say so.
 */

describe('keyset pagination', () => {
  describe('eventPrefix', () => {
    it('extracts the source prefix of a globally unique event id', () => {
      expect(eventPrefix('op:op_123')).toBe('op:');
      expect(eventPrefix('audit:evt_456')).toBe('audit:');
    });

    it('returns an empty prefix for an id without a source', () => {
      expect(eventPrefix('op_123')).toBe('');
    });
  });

  describe('sourceBoundary', () => {
    it('returns no boundary when there is no cursor', () => {
      expect(sourceBoundary(null, AUDIT_EVENT_PREFIX)).toBeNull();
      expect(sourceBoundary(undefined, OPERATION_EVENT_PREFIX)).toBeNull();
    });

    it('compares local ids when the cursor is in the same source', () => {
      expect(
        sourceBoundary({ at: '2026-10-25T00:00:00.000Z', id: 'audit:evt_9' }, 'audit:'),
      ).toEqual({ mode: 'compound', at: '2026-10-25T00:00:00.000Z', id: 'evt_9' });

      expect(
        sourceBoundary({ at: '2026-10-25T00:00:00.000Z', id: 'op:op_9' }, 'op:'),
      ).toEqual({ mode: 'compound', at: '2026-10-25T00:00:00.000Z', id: 'op_9' });
    });

    it('keeps the cross-source boundary consistent with the global order', () => {
      // The global order is `(at DESC, id DESC)` and the id is
      // source-prefixed. `op:` sorts *after* `audit:`, so:
      //
      //  * a cursor in `audit:` → the `op:` rows at that instant were
      //    already consumed → only the strictly older rows remain;
      //  * a cursor in `op:` → the `audit:` rows at that instant are still
      //    ahead of the cursor → the whole instant belongs to the next page.
      expect(
        sourceBoundary({ at: '2026-10-25T00:00:00.000Z', id: 'audit:evt_9' }, 'op:'),
      ).toEqual({ mode: 'before-at', at: '2026-10-25T00:00:00.000Z' });

      expect(
        sourceBoundary({ at: '2026-10-25T00:00:00.000Z', id: 'op:op_9' }, 'audit:'),
      ).toEqual({ mode: 'at-or-before', at: '2026-10-25T00:00:00.000Z' });
    });

    it('is symmetric — the two sources never claim the same rows', () => {
      const cursor = { at: '2026-10-25T00:00:00.000Z', id: 'audit:evt_9' };
      const auditBoundary = sourceBoundary(cursor, AUDIT_EVENT_PREFIX);
      const operationBoundary = sourceBoundary(cursor, OPERATION_EVENT_PREFIX);

      // The audit source uses the compound boundary (the cursor is local)…
      expect(auditBoundary?.mode).toBe('compound');
      // …and the operation source only the strictly older rows.
      expect(operationBoundary?.mode).toBe('before-at');
    });
  });
});
