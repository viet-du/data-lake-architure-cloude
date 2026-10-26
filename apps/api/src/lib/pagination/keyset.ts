/**
 * Keyset pagination for the merged activity feed.
 *
 * The feed merges two collections that are keyed differently (operations and
 * the audit ledger), so the cursor cannot be a single timestamp. This module
 * defines the one ordering the whole feed uses and translates it into the
 * per-source boundary each repository can push down.
 *
 * ## The global order
 *
 * Every event is exposed with a **source-prefixed id** (`op:<operationId>` /
 * `audit:<eventId>`), which makes the id globally unique and sortable. The
 * feed is ordered by `(at DESC, id DESC)`.
 *
 * ## Why a timestamp alone is not enough
 *
 * Several events routinely share the same millisecond. A timestamp-only
 * boundary is lossy in both directions:
 *
 *  * an *exclusive* bound drops the siblings that share the cursor's exact
 *    millisecond and sort after it, and
 *  * an *inclusive* bound re-reads the whole tie group, which silently drops
 *    the members that fall outside the fetched window.
 *
 * The compound position removes the ambiguity: exactly one row sorts
 * immediately after the cursor, and the rows before it are never re-read.
 *
 * ## Cross-source boundaries
 *
 * The cursor may point at an event of the *other* source. In that case there
 * is no local id to compare against, so the boundary is derived from the
 * prefix ordering (`audit:` < `op:`):
 *
 *  * a source whose prefix sorts *after* the cursor's prefix contributes
 *    nothing at the cursor's instant → `before-at`; and
 *  * a source whose prefix sorts *before* the cursor's prefix contributes
 *    its whole tie group → `at-or-before`.
 */

export interface CursorPosition {
  /** The ISO timestamp of the last returned event. */
  at: string;
  /** The globally unique, source-prefixed id of the last returned event. */
  id: string;
}

/** The source prefix of an operation event. */
export const OPERATION_EVENT_PREFIX = 'op:';
/** The source prefix of an audit event. */
export const AUDIT_EVENT_PREFIX = 'audit:';

/**
 * A source-local keyset boundary.
 *
 * The three modes are the three distinct answers to "which rows of *this*
 * source sort after the cursor":
 *
 *  * `before-at` — only the rows strictly before the instant;
 *  * `at-or-before` — every row up to and including the instant;
 *  * `compound` — the rows before the instant, plus the rows at the instant
 *    whose local id sorts before the cursor's local id.
 */
export type KeysetBoundary =
  | { mode: 'before-at'; at: string }
  | { mode: 'at-or-before'; at: string }
  | { mode: 'compound'; at: string; id: string };

/** The source prefix of a globally unique event id (`op:…` → `op:`). */
export function eventPrefix(id: string): string {
  const index = id.indexOf(':');
  return index === -1 ? '' : id.slice(0, index + 1);
}

/**
 * The boundary for one source, given the cursor of the merged feed.
 *
 * `sourcePrefix` is the prefix of the source being queried (`op:` or
 * `audit:`). The returned boundary is expressed in that source's own terms,
 * so the repository can push it down without knowing about the other source.
 */
export function sourceBoundary(
  cursor: CursorPosition | null | undefined,
  sourcePrefix: string,
): KeysetBoundary | null {
  if (!cursor) return null;

  const cursorPrefix = eventPrefix(cursor.id);

  // The cursor points into this source: compare the local ids.
  if (cursorPrefix === sourcePrefix) {
    return {
      mode: 'compound',
      at: cursor.at,
      id: cursor.id.slice(sourcePrefix.length),
    };
  }

  // The cursor points into the other source. The global id order is
  // `(at, prefix, localId)` and the feed sorts **descending**, so a source
  // whose prefix sorts *after* the cursor's prefix contributes rows that
  // already appeared on an earlier page, and a source whose prefix sorts
  // *before* contributes rows that belong to the next page:
  //
  //  * `sourcePrefix > cursorPrefix` → this source's rows at the cursor's
  //    instant sort *before* the cursor → they are already consumed →
  //    only the strictly older rows remain (`before-at`).
  //  * `sourcePrefix < cursorPrefix` → this source's rows at the cursor's
  //    instant sort *after* the cursor → they belong to the next page →
  //    the whole instant is included (`at-or-before`).
  return sourcePrefix > cursorPrefix
    ? { mode: 'before-at', at: cursor.at }
    : { mode: 'at-or-before', at: cursor.at };
}
