import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { PROFILE_STATUSES } from '../../types';

/**
 * The stored dataset profile.
 *
 * MASTER PLAN §07.2: "For large datasets, không nhét toàn bộ
 * `histogram/topValues/matrix` vào một response: profile summary nhỏ +
 * `GET /profiles/{id}/charts/{chartId}` lazy load/cached. Store external
 * artifacts in versioned/object storage nếu vượt Mongo document size;
 * record metadata/checksum/reference in Mongo."
 *
 * The document therefore keeps the *summary* and the per-column metadata in
 * Mongo, and the heavy artifacts (histograms, top values, correlation
 * matrices) are also kept here but are only *served* through the chart
 * endpoint. A `chartsStoredExternally` flag records the case where the
 * artifacts were too large for a Mongo document and were written to object
 * storage instead.
 */
const EdaProfileSchemaDef = new Schema(
  {
    profileId: { type: String, required: true, unique: true, index: true },
    operationId: { type: String, default: null, index: true },
    /** The canonical dataset id: `provider/layer.database.table`. */
    datasetId: { type: String, required: true, index: true },
    provider: { type: String, required: true },
    layer: { type: String, default: null },
    version: { type: Number, default: null },
    qualifiedName: { type: String, default: null },

    /** The request configuration — stored so a profile can be reproduced. */
    configured: { type: Schema.Types.Mixed, required: true },

    population: { type: Schema.Types.Mixed, required: true },
    coverage: { type: Schema.Types.Mixed, required: true },

    /**
     * The per-column statistics.
     *
     * The heavy per-column artifacts (histogram buckets, top values) are
     * stored in a *separate* collection so the summary document stays small
     * enough to load fast and the chart endpoint can page them.
     */
    columns: { type: [Schema.Types.Mixed], required: true, default: [] },

    relationships: { type: Schema.Types.Mixed, default: null },
    alerts: { type: [Schema.Types.Mixed], required: true, default: [] },

    status: { type: String, enum: PROFILE_STATUSES, required: true, default: 'queued', index: true },
    provenance: { type: Schema.Types.Mixed, required: true },
    schemaVersion: { type: Number, required: true, default: 1 },
    fingerprint: { type: String, required: true, index: true },
    errorMessage: { type: String, default: null },
    createdAt: { type: String, required: true, index: true },
  },
  { timestamps: true, collection: 'eda_profiles' },
);

// The listing query filters by dataset and time; the history view of one
// dataset is the common access pattern.
EdaProfileSchemaDef.index({ datasetId: 1, createdAt: -1 });
EdaProfileSchemaDef.index({ status: 1, createdAt: -1 });

export type EdaProfileDoc = InferSchemaType<typeof EdaProfileSchemaDef>;
export const EdaProfileModel: Model<EdaProfileDoc> =
  (models.EdaProfile as Model<EdaProfileDoc>) ||
  model<EdaProfileDoc>('EdaProfile', EdaProfileSchemaDef);
