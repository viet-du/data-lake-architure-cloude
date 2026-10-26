import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { AUDIT_OUTCOMES } from '../../types';

const AuditEventSchemaDef = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    requestId: { type: String, index: true },
    principalId: { type: String, required: true, index: true },
    principalKind: { type: String, enum: ['user', 'service', 'anonymous'], required: true, index: true },
    role: { type: String, required: true },
    synthetic: { type: Boolean, required: true, default: false },
    action: { type: String, required: true, index: true },
    method: { type: String, required: true },
    path: { type: String, required: true, index: true },
    resource: { type: String, index: true },
    resourceKind: { type: String },
    outcome: { type: String, enum: AUDIT_OUTCOMES, required: true, index: true },
    statusCode: { type: Number, required: true },
    durationMs: { type: Number, required: true, default: 0 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'audit_events' },
);

AuditEventSchemaDef.index({ createdAt: -1 });
AuditEventSchemaDef.index({ principalId: 1, createdAt: -1 });
AuditEventSchemaDef.index({ action: 1, createdAt: -1 });
// The compound keyset sort of the activity feed is `(createdAt DESC,
// eventId DESC)`. Without this index the cursor push-down degrades into a
// collection scan plus an in-memory sort, which is exactly the cost the
// push-down exists to avoid.
AuditEventSchemaDef.index({ createdAt: -1, eventId: -1 });

export type AuditEventDoc = InferSchemaType<typeof AuditEventSchemaDef>;
export const AuditEventModel: Model<AuditEventDoc> =
  (models.AuditEvent as Model<AuditEventDoc>) ||
  model<AuditEventDoc>('AuditEvent', AuditEventSchemaDef);
