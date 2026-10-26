import { getMongo } from '@/lib/infra/mongo';
import { EdaProfileModel } from './models/eda-profile.model';
import type { DatasetProfile, ProfileListResult, ProfileStatus } from '../types';

/**
 * The profile repository.
 *
 * The repository stores and reads the canonical `DatasetProfile` document.
 * It never computes anything — the engine does that — and it never
 * invents a field: a missing optional field is `undefined`, not a
 * fabricated zero.
 */
export const EdaProfileRepository = {
  async ensureConnection(): Promise<void> {
    await getMongo();
  },

  async create(profile: DatasetProfile): Promise<DatasetProfile> {
    await this.ensureConnection();
    const doc = await EdaProfileModel.create({
      profileId: profile.profileId,
      ...(profile.operationId ? { operationId: profile.operationId } : {}),
      datasetId: profile.dataset.datasetId,
      provider: profile.dataset.provider,
      ...(profile.dataset.layer ? { layer: profile.dataset.layer } : {}),
      ...(profile.dataset.version !== undefined ? { version: profile.dataset.version } : {}),
      ...(profile.dataset.qualifiedName ? { qualifiedName: profile.dataset.qualifiedName } : {}),
      configured: profile.configured,
      population: profile.population,
      coverage: profile.coverage,
      columns: profile.columns,
      ...(profile.relationships ? { relationships: profile.relationships } : {}),
      alerts: profile.alerts,
      status: profile.status,
      provenance: profile.provenance,
      schemaVersion: profile.schemaVersion,
      fingerprint: profile.fingerprint,
      ...(profile.errorMessage ? { errorMessage: profile.errorMessage } : {}),
      createdAt: profile.createdAt,
    });
    const plain = doc.toObject() as Record<string, unknown>;
    return toProfile(plain);
  },

  async findByProfileId(profileId: string): Promise<DatasetProfile | null> {
    await this.ensureConnection();
    const doc = (await EdaProfileModel.findOne({ profileId }).lean().exec()) as unknown as
      | Record<string, unknown>
      | null;
    return doc ? toProfile(doc) : null;
  },

  /**
   * Find a profile by its fingerprint.
   *
   * The fingerprint covers dataset + version + config, so a repeated
   * request with the same configuration resolves to the *same* profile.
   * This is what makes P0-EDA-04 ("same data/seed/config → identical
   * profile") observable instead of aspirational.
   */
  async findByFingerprint(fingerprint: string): Promise<DatasetProfile | null> {
    await this.ensureConnection();
    const doc = (await EdaProfileModel.findOne({ fingerprint })
      .sort({ createdAt: -1 })
      .lean()
      .exec()) as unknown as Record<string, unknown> | null;
    return doc ? toProfile(doc) : null;
  },

  async list(filter: {
    datasetId?: string;
    status?: ProfileStatus;
    limit: number;
    offset: number;
  }): Promise<ProfileListResult> {
    await this.ensureConnection();
    const query: Record<string, unknown> = {};
    if (filter.datasetId) query.datasetId = filter.datasetId;
    if (filter.status) query.status = filter.status;

    const [docs, total] = await Promise.all([
      EdaProfileModel.find(query)
        .sort({ createdAt: -1 })
        .skip(filter.offset)
        .limit(filter.limit)
        .lean()
        .exec() as unknown as Promise<Array<Record<string, unknown>>>,
      EdaProfileModel.countDocuments(query).exec(),
    ]);

    const profiles = docs.map((doc: Record<string, unknown>) => {
      const population = (doc.population ?? {}) as Record<string, unknown>;
      const alerts = (doc.alerts ?? []) as unknown[];
      const provenance = (doc.provenance ?? {}) as Record<string, unknown>;
      return {
        profileId: String(doc.profileId),
        datasetId: String(doc.datasetId),
        status: doc.status as ProfileStatus,
        createdAt: String(doc.createdAt),
        ...(provenance.computedAt ? { computedAt: String(provenance.computedAt) } : {}),
        rowCount: population.rowCount === undefined ? null : String(population.rowCount),
        columnCount: Number(population.columnCount ?? 0),
        alerts: alerts.length,
      };
    });

    return { profiles, total, limit: filter.limit, offset: filter.offset };
  },

  async updateStatus(
    profileId: string,
    status: ProfileStatus,
    patch: {
      errorMessage?: string;
      provenance?: Record<string, unknown>;
      population?: Record<string, unknown>;
      coverage?: Record<string, unknown>;
      columns?: unknown[];
      alerts?: unknown[];
      relationships?: Record<string, unknown> | null;
    } = {},
  ): Promise<DatasetProfile | null> {
    await this.ensureConnection();
    const set: Record<string, unknown> = { status };
    if (patch.errorMessage !== undefined) set.errorMessage = patch.errorMessage;
    if (patch.provenance !== undefined) set.provenance = patch.provenance;
    if (patch.population !== undefined) set.population = patch.population;
    if (patch.coverage !== undefined) set.coverage = patch.coverage;
    if (patch.columns !== undefined) set.columns = patch.columns;
    if (patch.alerts !== undefined) set.alerts = patch.alerts;
    if (patch.relationships !== undefined) set.relationships = patch.relationships;
    const doc = (await EdaProfileModel.findOneAndUpdate({ profileId }, { $set: set }, { new: true })
      .lean()
      .exec()) as unknown as Record<string, unknown> | null;
    return doc ? toProfile(doc) : null;
  },
};

/** Convert a Mongo document back into the canonical profile. */
function toProfile(doc: Record<string, unknown>): DatasetProfile {
  const provenance = (doc.provenance ?? {}) as Record<string, unknown>;
  const configured = (doc.configured ?? {}) as Record<string, unknown>;
  const population = (doc.population ?? {}) as Record<string, unknown>;
  const coverage = (doc.coverage ?? {}) as Record<string, unknown>;
  const relationships = doc.relationships as DatasetProfile['relationships'] | null;

  const layer = doc.layer ? String(doc.layer) : undefined;
  const version = doc.version === null || doc.version === undefined ? undefined : Number(doc.version);

  return {
    profileId: String(doc.profileId),
    ...(doc.operationId ? { operationId: String(doc.operationId) } : {}),
    dataset: {
      datasetId: String(doc.datasetId),
      provider: String(doc.provider),
      ...(layer ? { layer } : {}),
      ...(version !== undefined ? { version } : {}),
      ...(doc.qualifiedName ? { qualifiedName: String(doc.qualifiedName) } : {}),
    },
    configured: configured as unknown as DatasetProfile['configured'],
    population: population as unknown as DatasetProfile['population'],
    coverage: coverage as unknown as DatasetProfile['coverage'],
    columns: (doc.columns ?? []) as DatasetProfile['columns'],
    ...(relationships ? { relationships } : {}),
    alerts: (doc.alerts ?? []) as DatasetProfile['alerts'],
    status: doc.status as ProfileStatus,
    provenance: provenance as unknown as DatasetProfile['provenance'],
    schemaVersion: Number(doc.schemaVersion ?? 1),
    fingerprint: String(doc.fingerprint),
    createdAt: String(doc.createdAt),
    ...(doc.errorMessage ? { errorMessage: String(doc.errorMessage) } : {}),
  };
}
