import { AppError } from '@/errors';
import { logger } from '@/lib/logger';
import { defaultDatabaseFor, type DatasetLayer } from '@/modules/datasets/types';
import { DuckDBRepository } from '@/modules/catalog/repositories';
import { DqRuleRepository } from '../repositories';
import { DQ_PRESETS } from './dq.service';
import type { DqLayer, DqPreset, DqRule, DqRuleType } from '../types';

/**
 * The preset wizard.
 *
 * MASTER PLAN DQ-009: "Static `DQ_PRESETS` not applied to actual dataset →
 * Preset wizard checks columns/type, applies idempotently to selected
 * dataset/version, asks confirm."
 *
 * The three rules this service enforces:
 *
 *  1. **Column/type check** — a preset is never applied blindly. The
 *     candidate column must exist in the dataset and its physical type must
 *     be compatible with the rule type (a `range_check` needs a numeric
 *     column, a `regex` needs a string column, …).
 *  2. **Idempotency** — applying the same preset to the same dataset and
 *     column twice produces **one** rule. The identity key is
 *     `(presetId, layer, table, column)`, and it is stored as a rule tag so
 *     the check survives a restart.
 *  3. **No unrelated rules** — the wizard only ever creates the rule the
 *     user confirmed. It never applies the rest of the preset catalogue.
 */

/** The compatibility matrix between a rule type and a physical column type. */
const NUMERIC_TYPES = /^(tinyint|smallint|integer|int|bigint|hugeint|utinyint|usmallint|uinteger|ubigint|float|double|decimal|numeric|real)/i;
const STRING_TYPES = /^(varchar|char|text|string|bpchar)/i;
const TEMPORAL_TYPES = /^(timestamp|date|time|datetime)/i;

export type ColumnKind = 'numeric' | 'string' | 'temporal' | 'boolean' | 'other';

export function classifyColumnType(physicalType: string): ColumnKind {
  const type = (physicalType ?? '').trim();
  if (NUMERIC_TYPES.test(type)) return 'numeric';
  if (STRING_TYPES.test(type)) return 'string';
  if (TEMPORAL_TYPES.test(type)) return 'temporal';
  if (/^(bool|boolean)/i.test(type)) return 'boolean';
  return 'other';
}

/** Which column kinds a rule type can be evaluated against. */
const RULE_TYPE_COMPATIBILITY: Readonly<Record<DqRuleType, ReadonlyArray<ColumnKind>>> = {
  null_check: ['numeric', 'string', 'temporal', 'boolean', 'other'],
  range_check: ['numeric', 'temporal'],
  in_set: ['string', 'numeric', 'boolean'],
  unique: ['numeric', 'string', 'temporal', 'boolean', 'other'],
  regex: ['string'],
  // `custom_sql` is disabled at execution time (DQ-004); the wizard refuses
  // to create one so the user is not offered a rule that can never run.
  custom_sql: [],
};

export interface PresetApplicability {
  presetId: string;
  /** True when the preset can be applied to the requested dataset/column. */
  applicable: boolean;
  /** The column the preset would check — `null` when the preset has none. */
  column: string | null;
  /** The physical type of the resolved column. */
  columnType: string | null;
  /** The logical kind of the resolved column. */
  columnKind: ColumnKind | null;
  /** Why the preset cannot be applied (empty when it can). */
  reasons: string[];
}

export interface PresetApplyResult {
  presetId: string;
  /** The rule that now exists for this preset. */
  rule: DqRule;
  /** True when the rule already existed (nothing was created). */
  existing: boolean;
  /** The columns of the target dataset at the time of the check. */
  availableColumns: string[];
}

/** The tag prefix that marks a rule as preset-created. */
export const PRESET_TAG_PREFIX = 'preset:';

/** The deterministic identity of a preset application. */
export function presetIdentity(
  presetId: string,
  layer: DqLayer,
  table: string,
  column: string | null,
): string {
  return `${PRESET_TAG_PREFIX}${presetId}|${layer}|${table}|${column ?? '*'}`;
}

/**
 * Parse the dataset reference of a preset target.
 *
 * The wizard accepts the canonical `database.table` form and the bare table
 * name (resolved through the canonical table→database mapping).
 */
function parseTarget(
  table: string,
  layer: DqLayer,
): { database: string; table: string } {
  const raw = (table ?? '').trim();
  if (!raw) {
    throw new AppError(400, 'INVALID_DQ_DATASET', 'A preset needs a target dataset.');
  }
  if (raw.includes('.')) {
    const parts = raw.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new AppError(
        400,
        'INVALID_DQ_DATASET',
        `Invalid DQ dataset reference: ${raw}. Expected "database.table".`,
      );
    }
    return { database: parts[0], table: parts[1] };
  }
  return { database: defaultDatabaseFor(raw, layer as DatasetLayer), table: raw };
}

/**
 * Read the columns of the target dataset.
 *
 * The schema is read through the *catalog* DuckDB repository, so the wizard
 * validates against the same schema the user saw in the catalog. A dataset
 * that cannot be read yields an empty column list — the preset is then
 * reported as not applicable instead of being applied blindly.
 */
async function readColumns(
  layer: DqLayer,
  database: string,
  table: string,
): Promise<Array<{ name: string; type: string }>> {
  try {
    const info = await DuckDBRepository.getTableInfo(
      layer as 'bronze' | 'silver' | 'gold',
      database,
      table,
    );
    return info?.columns ?? [];
  } catch (error) {
    logger.warn(
      { layer, database, table, error: error instanceof Error ? error.message : String(error) },
      'Could not read the dataset schema for a preset check',
    );
    return [];
  }
}

/**
 * The preset catalogue.
 *
 * The presets are a *static* template catalogue (MASTER PLAN DQ-009 calls
 * the old behaviour a defect because the templates were never applied to a
 * real dataset). The catalogue itself stays static; the *application* is
 * what became dynamic — see `DqPresetService`.
 */
export const DqPresetCatalogueService = {
  async list(): Promise<{ total: number; items: DqPreset[] }> {
    return { total: DQ_PRESETS.length, items: DQ_PRESETS };
  },

  async get(presetId: string): Promise<DqPreset> {
    const preset = DQ_PRESETS.find((candidate) => candidate.presetId === presetId);
    if (!preset) {
      throw new AppError(404, 'PRESET_NOT_FOUND', `Preset not found: ${presetId}`);
    }
    return preset;
  },
};

export const DqPresetService = {
  /**
   * Check whether a preset can be applied to a dataset (and column).
   */
  async check(
    preset: DqPreset,
    target: { layer: DqLayer; table: string; column?: string | null },
  ): Promise<PresetApplicability> {
    const reasons: string[] = [];
    const { database, table } = parseTarget(target.table, target.layer);
    const columns = await readColumns(target.layer, database, table);

    if (columns.length === 0) {
      reasons.push(
        `The schema of ${target.layer}.${database}.${table} could not be read; the preset was not applied.`,
      );
      return {
        presetId: preset.presetId,
        applicable: false,
        column: null,
        columnType: null,
        columnKind: null,
        reasons,
      };
    }

    // `unique` on a whole table has no single column — the caller must name
    // the key column. Every other preset type needs one column too.
    const requested = (target.column ?? '').trim();
    if (!requested) {
      reasons.push('Select the column the preset should check.');
      return {
        presetId: preset.presetId,
        applicable: false,
        column: null,
        columnType: null,
        columnKind: null,
        reasons,
      };
    }

    const column = columns.find((candidate) => candidate.name === requested);
    if (!column) {
      reasons.push(
        `The column "${requested}" does not exist in ${target.layer}.${database}.${table}. ` +
          `Available columns: ${columns.map((c) => c.name).join(', ')}.`,
      );
      return {
        presetId: preset.presetId,
        applicable: false,
        column: requested,
        columnType: null,
        columnKind: null,
        reasons,
      };
    }

    const kind = classifyColumnType(column.type);
    const compatible = RULE_TYPE_COMPATIBILITY[preset.type] ?? [];
    if (!compatible.includes(kind)) {
      reasons.push(
        `A ${preset.type} rule cannot be applied to the ${kind} column "${requested}" (${column.type}).`,
      );
    }

    return {
      presetId: preset.presetId,
      applicable: reasons.length === 0,
      column: column.name,
      columnType: column.type,
      columnKind: kind,
      reasons,
    };
  },

  /**
   * Apply a preset to a dataset.
   *
   * The operation is idempotent: the identity tag
   * `preset:{presetId}|{layer}|{table}|{column}` is checked before creating
   * a rule, so a repeated apply returns the existing rule instead of
   * creating a duplicate.
   */
  async apply(
    preset: DqPreset,
    target: { layer: DqLayer; table: string; column?: string | null },
    options: { severity?: DqPreset['severity']; enabled?: boolean } = {},
  ): Promise<PresetApplyResult> {
    const check = await this.check(preset, target);
    if (!check.applicable || check.column === null) {
      throw new AppError(
        422,
        'PRESET_NOT_APPLICABLE',
        check.reasons.join(' ') || 'The preset cannot be applied to this dataset.',
      );
    }

    const { database, table } = parseTarget(target.table, target.layer);
    const canonicalTable = `${database}.${table}`;
    const identity = presetIdentity(preset.presetId, target.layer, canonicalTable, check.column);

    const existing = await DqRuleRepository.list({
      tag: identity,
      limit: 1,
      offset: 0,
    });
    const found = existing.items[0];
    if (found) {
      logger.info(
        { presetId: preset.presetId, ruleId: found.ruleId, identity },
        'Preset already applied — no duplicate rule created',
      );
      return {
        presetId: preset.presetId,
        rule: found,
        existing: true,
        availableColumns: [],
      };
    }

    const rule = await DqRuleRepository.create({
      name: `${target.layer} ${canonicalTable}: ${preset.name} [${check.column}]`,
      description: `${preset.description} (applied from preset ${preset.presetId})`,
      type: preset.type,
      layer: target.layer,
      table: canonicalTable,
      column: check.column,
      params: preset.params,
      severity: options.severity ?? preset.severity,
      enabled: options.enabled ?? false,
      tags: [...preset.tags, identity, `preset:${preset.presetId}`],
    });

    logger.info(
      { presetId: preset.presetId, ruleId: rule.ruleId, dataset: canonicalTable, column: check.column },
      'DQ preset applied',
    );

    return { presetId: preset.presetId, rule, existing: false, availableColumns: [] };
  },
};
