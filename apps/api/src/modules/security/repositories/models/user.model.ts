import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { SECURITY_ROLES } from '../../types';

const UserSchemaDef = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true },
    displayName: { type: String, required: true },
    role: { type: String, enum: SECURITY_ROLES, required: true, index: true },
    /**
     * scrypt digest. The plaintext password is never stored and never
     * leaves the server.
     */
    passwordHash: { type: String, required: true },
    /** Resource scopes that narrow the role's authority. */
    scopes: { type: [String], required: true, default: [] },
    disabled: { type: Boolean, required: true, default: false, index: true },
    lastLoginAt: { type: String },
  },
  { timestamps: true, collection: 'control_plane_users' },
);

UserSchemaDef.index({ email: 1, disabled: 1 });

export type UserDoc = InferSchemaType<typeof UserSchemaDef>;
export const UserModel: Model<UserDoc> =
  (models.ControlPlaneUser as Model<UserDoc>) ||
  model<UserDoc>('ControlPlaneUser', UserSchemaDef);
