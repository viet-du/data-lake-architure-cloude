import { getMongo } from '@/lib/infra/mongo';
import { UserModel } from './models/user.model';
import type { SecurityRole } from '../types';

async function ensureConnection(): Promise<void> {
  await getMongo();
}

export interface UserRecord {
  userId: string;
  email: string;
  displayName: string;
  role: SecurityRole;
  passwordHash: string;
  scopes: string[];
  disabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function userFromDoc(doc: Record<string, unknown>): UserRecord {
  return {
    userId: doc.userId as string,
    email: doc.email as string,
    displayName: doc.displayName as string,
    role: doc.role as SecurityRole,
    passwordHash: doc.passwordHash as string,
    scopes: ((doc.scopes as string[]) ?? []).slice(),
    disabled: (doc.disabled as boolean) ?? false,
    lastLoginAt: (doc.lastLoginAt as string | null | undefined) ?? null,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

export const UserRepository = {
  async findByEmail(email: string): Promise<UserRecord | null> {
    await ensureConnection();
    const doc = await UserModel.findOne({ email: email.trim().toLowerCase() }).lean();
    return doc ? userFromDoc(doc as unknown as Record<string, unknown>) : null;
  },

  async findById(userId: string): Promise<UserRecord | null> {
    await ensureConnection();
    const doc = await UserModel.findOne({ userId }).lean();
    return doc ? userFromDoc(doc as unknown as Record<string, unknown>) : null;
  },

  async list(): Promise<UserRecord[]> {
    await ensureConnection();
    const docs = await UserModel.find().sort({ createdAt: -1 }).lean();
    return docs.map((doc) => userFromDoc(doc as unknown as Record<string, unknown>));
  },

  async create(input: {
    userId: string;
    email: string;
    displayName: string;
    role: SecurityRole;
    passwordHash: string;
    scopes: string[];
  }): Promise<UserRecord> {
    await ensureConnection();
    const created = await UserModel.create({ ...input, disabled: false });
    return userFromDoc(created.toObject() as unknown as Record<string, unknown>);
  },

  async update(
    userId: string,
    patch: Partial<Pick<UserRecord, 'displayName' | 'role' | 'scopes' | 'disabled' | 'passwordHash'>>,
  ): Promise<UserRecord | null> {
    await ensureConnection();
    const update: Record<string, unknown> = {};
    if (patch.displayName !== undefined) update.displayName = patch.displayName;
    if (patch.role !== undefined) update.role = patch.role;
    if (patch.scopes !== undefined) update.scopes = patch.scopes;
    if (patch.disabled !== undefined) update.disabled = patch.disabled;
    if (patch.passwordHash !== undefined) update.passwordHash = patch.passwordHash;
    const updated = await UserModel.findOneAndUpdate({ userId }, { $set: update }, { new: true }).lean();
    return updated ? userFromDoc(updated as unknown as Record<string, unknown>) : null;
  },

  async recordLogin(userId: string): Promise<void> {
    await ensureConnection();
    await UserModel.updateOne({ userId }, { $set: { lastLoginAt: new Date().toISOString() } });
  },
};
