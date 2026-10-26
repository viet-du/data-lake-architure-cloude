import { randomUUID } from 'node:crypto';
import { AppError } from '@/errors';
import { NotFoundError } from '@/errors';
import { logger } from '@/lib/logger';
import { getDuckDB } from '@/lib/infra/duckdb';
import { resolveDataset } from '@/modules/datasets/types';
import { DqRuleService } from '@/modules/dq/services';
import { EdaProfileRepository } from '../repositories';
import {
  computeFingerprint,
  profileDatabricksDataset,
  profileLocalDataset,
  readSample,
  resolveProfileDataset,
  type ProfileRunResult,
} from '../engines';
import type {
  ColumnProfile,
  DatasetProfile,
  ProfileChart,
  ProfileConfig,
  ProfileListResult,
} from '../types';
import type {
  TCompareProfilesBody,
  TCreateProfileBody,
  TProfileColumnsQuery,
  TProfileListQuery,
  TProfileSampleQuery,
  TProposeRuleBody,
} from '../schemas';

/**
 * The EDA / profiling service.
 *
 * MASTER PLAN §07.1 + §09.4. The service owns:
 *
 *  * the **identity** of a profile — `profileId` and the fingerprint that
 *    proves two requests asked for the same thing (P0-EDA-04);
 *  * the **routing** to the engine — the local Delta engine or the
 *    Databricks SQL adapter, chosen by the resolved dataset provider;
 *  * the **error semantics** — a profile that could not be computed is
 *    stored as `failed` with the real reason, never as an empty
 *    "successful" profile that looks like "the dataset has no data";
 *  * the **chart projection** — heavy artifacts are served through
 *    `/charts/{chartId}`, not through the summary response.
 */

/** The contract version of the stored profile document. */
const PROFILE_SCHEMA_VERSION = 1;

function newProfileId(): string {
  return `prof_${Date.now().toString(36)}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Build the effective profile configuration from the request. */
function buildConfig(body: TCreateProfileBody): ProfileConfig {
  return {
    columns: body.columns,
    analyses: body.analyses,
    includeCorrelation: body.includeCorrelation,
    sampleStrategy: body.samplePolicy,
    ...(body.sampleSize !== undefined ? { sampleSize: body.sampleSize } : {}),
    ...(body.seed !== undefined ? { seed: body.seed } : {}),
    ...(body.filters ? { filters: body.filters } : {}),
  };
}

export const EdaService = {
  /**
   * Compute a dataset profile.
   *
   * The profile is stored *before* the engine runs, in the `queued`
   * state, so a crash in the middle of a long scan leaves a visible
   * record instead of an invisible partial result. The state then moves
   * to `succeeded`, `partial` or `failed` with the real outcome.
   */
  async create(body: TCreateProfileBody): Promise<DatasetProfile> {
    const ref = resolveProfileDataset({
      ...(body.dataset.datasetId ? { datasetId: body.dataset.datasetId } : {}),
      ...(body.dataset.provider ? { provider: body.dataset.provider } : {}),
      ...(body.dataset.layer ? { layer: body.dataset.layer } : {}),
      ...(body.dataset.database ? { database: body.dataset.database } : {}),
      ...(body.dataset.table ? { table: body.dataset.table } : {}),
      ...(body.version !== undefined ? { version: body.version } : {}),
    });

    const config = buildConfig(body);
    const fingerprint = computeFingerprint(ref.datasetId, body.version, config);

    // A repeated request with the same dataset + version + configuration
    // resolves to the existing profile: the profile is a *result*, not a
    // re-run. This is what makes the reproducibility requirement
    // observable (P0-EDA-04).
    const existing = await EdaProfileRepository.findByFingerprint(fingerprint);
    if (existing && existing.status === 'succeeded') return existing;

    const profileId = existing?.profileId ?? newProfileId();
    const createdAt = existing?.createdAt ?? new Date().toISOString();

    const pending: DatasetProfile = {
      profileId,
      dataset: {
        datasetId: ref.datasetId,
        provider: ref.provider,
        ...(ref.layer ? { layer: ref.layer } : {}),
        ...(body.version !== undefined ? { version: body.version } : {}),
        ...(ref.qualifiedName ? { qualifiedName: ref.qualifiedName } : {}),
      },
      configured: config,
      population: { rowCount: null, estimate: false, columnCount: 0 },
      coverage: { rowsObserved: '0' },
      columns: [],
      alerts: [],
      status: 'queued',
      provenance: {
        engine: ref.provider === 'databricks_uc' ? 'databricks-sql-warehouse' : 'duckdb-delta',
        samplePolicy: config.sampleStrategy,
        approximate: config.sampleStrategy !== 'full',
      },
      schemaVersion: PROFILE_SCHEMA_VERSION,
      fingerprint,
      createdAt,
    };

    if (!existing) {
      await EdaProfileRepository.create(pending);
    } else {
      await EdaProfileRepository.updateStatus(profileId, 'running');
    }

    try {
      const result =
        ref.provider === 'databricks_uc'
          ? await this.runDatabricks(ref, config)
          : await this.runLocal(ref, config);

      const completed: DatasetProfile = {
        ...pending,
        dataset: pending.dataset,
        population: result.population,
        coverage: result.coverage,
        columns: result.columns,
        ...(result.relationships ? { relationships: result.relationships } : {}),
        alerts: result.alerts,
        status: 'succeeded',
        provenance: result.provenance,
      };

      const stored = await EdaProfileRepository.updateStatus(profileId, 'succeeded', {
        provenance: result.provenance as unknown as Record<string, unknown>,
        population: result.population as unknown as Record<string, unknown>,
        coverage: result.coverage as unknown as Record<string, unknown>,
        columns: result.columns,
        alerts: result.alerts,
        relationships: result.relationships
          ? (result.relationships as unknown as Record<string, unknown>)
          : null,
      });

      logger.info(
        {
          profileId,
          datasetId: ref.datasetId,
          engine: result.provenance.engine,
          columns: result.columns.length,
          elapsedMs: result.provenance.elapsedMs,
        },
        'Dataset profile computed',
      );

      // The stored document is authoritative; the in-memory copy is only
      // used when the update could not be applied (a race with a delete).
      return stored ?? completed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = error instanceof AppError ? error.code : 'PROFILE_FAILED';
      await EdaProfileRepository.updateStatus(profileId, 'failed', {
        errorMessage: `${code}: ${message}`,
      });
      logger.error({ profileId, datasetId: ref.datasetId, code, error: message }, 'Profiling failed');
      throw error instanceof AppError
        ? error
        : new AppError(500, 'PROFILE_FAILED', message);
    }
  },

  async runLocal(
    ref: Awaited<ReturnType<typeof resolveProfileDataset>>,
    config: ProfileConfig,
  ): Promise<ProfileRunResult> {
    const run = await profileLocalDataset({ ref, config });
    return {
      dataset: { ref },
      configured: run.configured,
      population: run.population,
      coverage: run.coverage,
      columns: run.columns,
      ...(run.relationships ? { relationships: run.relationships } : {}),
      alerts: run.alerts,
      provenance: run.provenance,
    };
  },

  async runDatabricks(
    ref: Awaited<ReturnType<typeof resolveProfileDataset>>,
    config: ProfileConfig,
  ): Promise<ProfileRunResult> {
    const run = await profileDatabricksDataset({ ref, config });
    return {
      dataset: { ref },
      configured: config,
      population: run.population,
      coverage: run.coverage,
      columns: run.columns,
      ...(run.relationships ? { relationships: run.relationships } : {}),
      alerts: run.alerts,
      provenance: run.provenance,
    };
  },

  async getOrFail(profileId: string): Promise<DatasetProfile> {
    const profile = await EdaProfileRepository.findByProfileId(profileId);
    if (!profile) throw new NotFoundError('Profile', profileId);
    return profile;
  },

  async list(query: TProfileListQuery): Promise<ProfileListResult> {
    return EdaProfileRepository.list({
      limit: query.limit,
      offset: query.offset,
      ...(query.datasetId ? { datasetId: query.datasetId } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
  },

  /**
   * The paged column profiles.
   *
   * The endpoint pages the columns so a wide table never forces the
   * browser to render hundreds of cards at once.
   */
  async columns(
    profileId: string,
    query: TProfileColumnsQuery,
  ): Promise<{ profileId: string; total: number; columns: ColumnProfile[] }> {
    const profile = await this.getOrFail(profileId);
    const columns = profile.columns.slice(query.offset, query.offset + query.limit);
    return { profileId, total: profile.columns.length, columns };
  },

  /**
   * A bounded, typed chart aggregate.
   *
   * MASTER PLAN §09.4: the chart endpoint serves the heavy artifacts. The
   * chart id is deterministic — `missing`, `histogram:<column>`,
   * `box:<column>`, `categorical:<column>`, `temporal:<column>`,
   * `correlation` — so the UI can request exactly what it renders.
   */
  async chart(profileId: string, chartId: string): Promise<ProfileChart> {
    const profile = await this.getOrFail(profileId);
    return this.buildChart(profile, chartId);
  },

  async charts(profileId: string): Promise<ProfileChart[]> {
    const profile = await this.getOrFail(profileId);
    const ids: string[] = ['missing'];
    for (const column of profile.columns) {
      if (column.logicalType === 'numeric') {
        ids.push(`histogram:${column.name}`, `box:${column.name}`);
      } else if (column.topValues && column.topValues.length > 0) {
        ids.push(`categorical:${column.name}`);
      } else if (column.logicalType === 'datetime') {
        ids.push(`temporal:${column.name}`);
      }
    }
    if (profile.relationships) ids.push('correlation');
    const charts: ProfileChart[] = [];
    for (const id of ids) {
      charts.push(this.buildChart(profile, id));
    }
    return charts;
  },

  buildChart(profile: DatasetProfile, chartId: string): ProfileChart {
    if (chartId === 'missing') {
      const categories: string[] = [];
      const values: number[] = [];
      for (const column of profile.columns) {
        const total = Number(column.nonNullCount) + Number(column.nullCount);
        categories.push(column.name);
        values.push(total > 0 ? Number(column.nullCount) / total : 0);
      }
      return {
        chartId: 'missing',
        type: 'missing',
        title: 'Missing values by column',
        categories,
        values,
        meta: { unit: 'ratio' },
      };
    }

    if (chartId === 'correlation') {
      const relationships = profile.relationships;
      if (!relationships) {
        throw new AppError(404, 'CHART_NOT_AVAILABLE', 'This profile has no correlation matrix.');
      }
      return {
        chartId: 'correlation',
        type: 'correlation',
        title: 'Correlation matrix',
        categories: relationships.columns,
        values: relationships.matrix.flat(),
        meta: { matrix: relationships.matrix, method: relationships.method },
      };
    }

    const separator = chartId.indexOf(':');
    const kind = separator === -1 ? chartId : chartId.slice(0, separator);
    const columnName = separator === -1 ? '' : chartId.slice(separator + 1);
    const column = profile.columns.find((candidate) => candidate.name === columnName);
    if (!column) {
      throw new AppError(404, 'CHART_NOT_AVAILABLE', `Unknown chart column: ${columnName}`);
    }

    if (kind === 'histogram') {
      const buckets = column.histogram ?? [];
      return {
        chartId,
        type: 'histogram',
        title: `${column.name} — distribution`,
        column: column.name,
        categories: buckets.map((bucket) => bucket.lower),
        values: buckets.map((bucket) => Number(bucket.count)),
        meta: { upper: buckets.map((bucket) => bucket.upper) },
      };
    }

    if (kind === 'box') {
      const q1 = column.p25;
      const median = column.median;
      const q3 = column.p75;
      const min = column.min;
      const max = column.max;
      return {
        chartId,
        type: 'box',
        title: `${column.name} — box plot`,
        column: column.name,
        categories: ['min', 'p25', 'median', 'p75', 'max'],
        values: [
          min === null || min === undefined ? 0 : Number(min),
          q1 === null || q1 === undefined ? 0 : Number(q1),
          median === null || median === undefined ? 0 : Number(median),
          q3 === null || q3 === undefined ? 0 : Number(q3),
          max === null || max === undefined ? 0 : Number(max),
        ],
        meta: { iqr: column.iqr ?? null },
      };
    }

    if (kind === 'categorical') {
      const top = column.topValues ?? [];
      return {
        chartId,
        type: 'categorical',
        title: `${column.name} — top values`,
        column: column.name,
        categories: top.map((entry) => entry.value),
        values: top.map((entry) => Number(entry.count)),
      };
    }

    if (kind === 'temporal') {
      return {
        chartId,
        type: 'temporal',
        title: `${column.name} — range`,
        column: column.name,
        categories: ['min', 'max'],
        values: [column.min ?? 0, column.max ?? 0],
      };
    }

    throw new AppError(404, 'CHART_NOT_AVAILABLE', `Unknown chart: ${chartId}`);
  },

  /**
   * A bounded, representative sample of the profiled dataset.
   *
   * The sample is read from the *current* snapshot of the dataset, so the
   * response states which snapshot it came from. PII is not masked here —
   * the route requires the `dataset:sample` permission, and the caller
   * decides which columns it may show.
   */
  async sample(profileId: string, query: TProfileSampleQuery): Promise<{
    profileId: string;
    datasetId: string;
    limit: number;
    rows: Array<Record<string, unknown>>;
  }> {
    const profile = await this.getOrFail(profileId);
    if (profile.dataset.provider !== 'local_delta_minio') {
      throw new AppError(
        409,
        'PROFILE_SAMPLE_UNAVAILABLE',
        'The representative sample is only available for the local Delta lakehouse.',
      );
    }
    const ref = resolveDataset({
      provider: 'local_delta_minio',
      layer: (profile.dataset.layer ?? 'bronze') as 'bronze' | 'silver' | 'gold',
      database: profile.dataset.datasetId.split('.')[1] ?? 'default',
      table: profile.dataset.datasetId.split('.')[2] ?? 'default',
    });

    const instance = await getDuckDB();
    const conn = await instance.connect();
    try {
      const path = ref.storagePath!;
      const safePath = path.replace(/'/g, "''");
      const rows = await readSample(conn, `delta_scan('${safePath}')`, query.limit);
      return { profileId, datasetId: profile.dataset.datasetId, limit: query.limit, rows };
    } finally {
      try {
        conn.closeSync();
      } catch (closeError) {
        logger.warn({ error: closeError }, 'Failed to close the DuckDB sample connection');
      }
    }
  },

  /**
   * Compare two profiles.
   *
   * MASTER PLAN §12: a comparison states the *difference* per column and
   * whether the change is statistically meaningful. With the observed
   * sample sizes the engine can report a simple two-proportion z-test for
   * the missingness and the effect size for the numeric means; every
   * qualification the master plan demands (sample size, approximation,
   * method) is part of the response.
   */
  async compare(body: TCompareProfilesBody): Promise<{
    comparisonId: string;
    baseline: { profileId: string; computedAt?: string; fingerprint: string };
    candidate: { profileId: string; computedAt?: string; fingerprint: string };
    comparable: boolean;
    reasons: string[];
    columns: Array<{
      name: string;
      baselineNullRate: number | null;
      candidateNullRate: number | null;
      nullRateDelta: number | null;
      baselineMean: number | null;
      candidateMean: number | null;
      meanDelta: number | null;
      /** Cohen's d — the effect size of the mean change. */
      effectSize: number | null;
      /** The two-proportion z-score of the null-rate change. */
      zScore: number | null;
      /** Whether the change exceeds the disclosed threshold. */
      significant: boolean;
    }>;
  }> {
    const baseline = await this.getOrFail(body.baselineProfileId);
    const candidate = await this.getOrFail(body.profileId);

    const reasons: string[] = [];
    if (baseline.dataset.datasetId !== candidate.dataset.datasetId) {
      reasons.push('The two profiles describe different datasets.');
    }
    if (baseline.provenance.samplePolicy !== candidate.provenance.samplePolicy) {
      reasons.push('The two profiles used different sampling policies.');
    }
    if (baseline.provenance.approximate !== candidate.provenance.approximate) {
      reasons.push('One profile is approximate and the other is exact.');
    }

    const baselineRows = Number(baseline.coverage.rowsObserved ?? 0);
    const candidateRows = Number(candidate.coverage.rowsObserved ?? 0);
    if (baselineRows === 0 || candidateRows === 0) {
      reasons.push('One of the profiles observed no rows.');
    }

    const baselineColumns = new Map(baseline.columns.map((c) => [c.name, c]));
    const columns = candidate.columns.map((column) => {
      const before = baselineColumns.get(column.name);
      const baselineTotal = before
        ? Number(before.nonNullCount) + Number(before.nullCount)
        : 0;
      const candidateTotal = Number(column.nonNullCount) + Number(column.nullCount);
      const baselineNullRate = baselineTotal > 0 ? Number(before!.nullCount) / baselineTotal : null;
      const candidateNullRate = candidateTotal > 0 ? Number(column.nullCount) / candidateTotal : null;
      const nullRateDelta =
        baselineNullRate === null || candidateNullRate === null
          ? null
          : candidateNullRate - baselineNullRate;

      const baselineMean = before?.mean ?? null;
      const candidateMean = column.mean ?? null;
      const meanDelta =
        baselineMean === null || candidateMean === null ? null : candidateMean - baselineMean;

      // Cohen's d — the pooled standard deviation gives the scale.
      let effectSize: number | null = null;
      if (
        baselineMean !== null &&
        candidateMean !== null &&
        before?.std !== undefined &&
        before.std !== null &&
        column.std !== undefined &&
        column.std !== null
      ) {
        const pooled = Math.sqrt(
          (before.std ** 2 + column.std ** 2) / 2,
        );
        if (pooled > 0) effectSize = (candidateMean - baselineMean) / pooled;
      }

      const zScore = twoProportionZScore(
        baselineNullRate,
        baselineRows,
        candidateNullRate,
        candidateRows,
      );

      // The significance threshold is disclosed, not hidden: a null-rate
      // change of more than 1 percentage point *and* a z-score beyond 1.96.
      const significant =
        nullRateDelta !== null && Math.abs(nullRateDelta) >= 0.01 && zScore !== null && Math.abs(zScore) >= 1.96;

      return {
        name: column.name,
        baselineNullRate,
        candidateNullRate,
        nullRateDelta,
        baselineMean,
        candidateMean,
        meanDelta,
        effectSize,
        zScore,
        significant,
      };
    });

    return {
      comparisonId: `cmp_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      baseline: {
        profileId: baseline.profileId,
        ...(baseline.provenance.computedAt ? { computedAt: baseline.provenance.computedAt } : {}),
        fingerprint: baseline.fingerprint,
      },
      candidate: {
        profileId: candidate.profileId,
        ...(candidate.provenance.computedAt ? { computedAt: candidate.provenance.computedAt } : {}),
        fingerprint: candidate.fingerprint,
      },
      comparable: reasons.length === 0,
      reasons,
      columns,
    };
  },

  /**
   * The EDA → DQ bridge.
   *
   * MASTER PLAN §07.5: "EDA finding `email null 12%` suggests configurable
   * `null_check` with threshold selected by domain owner; chart offers
   * `[Propose rule]` with prefilled dataset/column, default disabled/draft;
   * user reviews and saves version."
   *
   * The bridge therefore creates a **disabled** rule by default, with the
   * observed null percentage as the suggested threshold. It never enables
   * a rule without an explicit request.
   */
  async proposeRule(body: TProposeRuleBody): Promise<{
    ruleId: string;
    name: string;
    type: string;
    layer: string;
    table: string;
    column: string;
    params: Record<string, unknown>;
    enabled: boolean;
    severity: string;
    suggestedThreshold: number | null;
    created: boolean;
  }> {
    const profile = await this.getOrFail(body.profileId);
    const column = profile.columns.find((candidate) => candidate.name === body.column);
    if (!column) {
      throw new AppError(
        404,
        'PROFILE_COLUMN_NOT_FOUND',
        `Column "${body.column}" is not part of profile ${body.profileId}.`,
      );
    }

    const layer = profile.dataset.layer ?? 'bronze';
    const table = profile.dataset.datasetId.split('.').slice(1).join('.') || 'default';

    const total = Number(column.nonNullCount) + Number(column.nullCount);
    const observedNullPercent = total > 0 ? (Number(column.nullCount) / total) * 100 : 0;
    const threshold =
      body.threshold !== undefined ? body.threshold : Number(observedNullPercent.toFixed(2));

    const params: Record<string, unknown> = {};
    switch (body.type) {
      case 'null_check':
        params.maxNullPercent = threshold;
        break;
      case 'range_check':
        if (column.min !== undefined && column.min !== null) params.min = column.min;
        if (column.max !== undefined && column.max !== null) params.max = column.max;
        break;
      case 'unique':
        break;
      case 'in_set':
        params.values = (column.topValues ?? []).map((entry) => entry.value);
        break;
      case 'regex':
        // A regex cannot be derived from a profile — the bridge must not
        // invent a pattern that looks authoritative.
        throw new AppError(
          422,
          'PROFILE_RULE_NOT_DERIVABLE',
          'A regex rule cannot be derived from a profile; create it manually with the intended pattern.',
        );
    }

    const name =
      body.name ??
      `${layer} ${table}: ${column.name} ${body.type.replace(/_/g, ' ')} (from profile ${profile.profileId})`;

    const rule = await DqRuleService.create({
      name,
      description: `Proposed from the EDA profile ${profile.profileId}: ${column.name} is null in ${observedNullPercent.toFixed(2)}% of the observed rows.`,
      type: body.type,
      layer: layer as 'bronze' | 'silver' | 'gold',
      table,
      column: body.column,
      params,
      severity: 'medium',
      enabled: body.enabled,
      tags: ['eda-proposed', profile.dataset.datasetId],
    });

    logger.info(
      { profileId: body.profileId, ruleId: rule.ruleId, column: body.column },
      'DQ rule proposed from an EDA finding',
    );

    return {
      ruleId: rule.ruleId,
      name: rule.name,
      type: rule.type,
      layer: rule.layer,
      table: rule.table,
      column: rule.column ?? body.column,
      params: rule.params,
      enabled: rule.enabled,
      severity: rule.severity,
      suggestedThreshold: threshold,
      created: true,
    };
  },
};

/**
 * The two-proportion z-test.
 *
 * It compares the null rate of two independent samples. The score is
 * `null` when the test is not defined (an empty sample, or a degenerate
 * pooled proportion), so the caller never renders a misleading `0`.
 */
function twoProportionZScore(
  rateA: number | null,
  sizeA: number,
  rateB: number | null,
  sizeB: number,
): number | null {
  if (rateA === null || rateB === null) return null;
  if (sizeA <= 0 || sizeB <= 0) return null;
  const pooled = (rateA * sizeA + rateB * sizeB) / (sizeA + sizeB);
  if (pooled <= 0 || pooled >= 1) return null;
  const standardError = Math.sqrt(pooled * (1 - pooled) * (1 / sizeA + 1 / sizeB));
  if (standardError <= 0) return null;
  return (rateB - rateA) / standardError;
}
