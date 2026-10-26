import { randomUUID } from 'node:crypto';
import { env } from '@/config';
import { AppError } from '@/errors';
import { logger } from '@/lib/logger';
import { UserRepository, type UserRecord } from '../repositories';
import { assertPasswordPolicy, hashPassword, verifyPassword } from './password.service';
import { issueConfirmToken, issueSessionToken, verifyConfirmToken } from './token.service';
import type { Principal, SecurityRole } from '../types';

const authLogger = logger.child({ module: 'auth' });

export interface LoginResult {
  token: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: SecurityRole;
    scopes: string[];
  };
}

/**
 * Authentication service.
 *
 * The failure paths deliberately share one message ("Invalid credentials")
 * so a caller cannot enumerate registered accounts.
 */
export const AuthService = {
  /**
   * Exchange credentials for a session token.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await UserRepository.findByEmail(email);
    if (!user || user.disabled) {
      // Spend a comparable amount of time so a missing account is not
      // distinguishable from a wrong password by response time.
      verifyPassword(password, 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    if (!verifyPassword(password, user.passwordHash)) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const session = issueSessionToken({
      principalId: user.userId,
      role: user.role,
      scopes: user.scopes,
    });
    await UserRepository.recordLogin(user.userId);
    authLogger.info({ userId: user.userId, role: user.role }, 'User signed in');
    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        id: user.userId,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        scopes: user.scopes,
      },
    };
  },

  async listUsers(): Promise<Array<Omit<UserRecord, 'passwordHash'>>> {
    const users = await UserRepository.list();
    return users.map(({ passwordHash: _passwordHash, ...rest }) => rest);
  },

  async getUser(userId: string): Promise<Omit<UserRecord, 'passwordHash'>> {
    const user = await UserRepository.findById(userId);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', `User not found: ${userId}`);
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  },

  /**
   * Create a control-plane user.
   *
   * The password is hashed immediately; the plaintext is never persisted and
   * never returned.
   */
  async createUser(input: {
    email: string;
    displayName: string;
    role: SecurityRole;
    password: string;
    scopes: string[];
  }): Promise<Omit<UserRecord, 'passwordHash'>> {
    assertPasswordPolicy(input.password);
    const existing = await UserRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError(409, 'USER_EXISTS', `A user with this email already exists.`);
    }
    const created = await UserRepository.create({
      userId: randomUUID(),
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName,
      role: input.role,
      passwordHash: hashPassword(input.password),
      scopes: input.scopes,
    });
    const { passwordHash: _passwordHash, ...rest } = created;
    authLogger.info({ userId: created.userId, role: created.role }, 'Control-plane user created');
    return rest;
  },

  async updateUser(
    userId: string,
    patch: {
      displayName?: string;
      role?: SecurityRole;
      scopes?: string[];
      disabled?: boolean;
      password?: string;
    },
  ): Promise<Omit<UserRecord, 'passwordHash'>> {
    if (patch.password !== undefined) {
      assertPasswordPolicy(patch.password);
    }
    const updated = await UserRepository.update(userId, {
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.scopes !== undefined ? { scopes: patch.scopes } : {}),
      ...(patch.disabled !== undefined ? { disabled: patch.disabled } : {}),
      ...(patch.password !== undefined ? { passwordHash: hashPassword(patch.password) } : {}),
    });
    if (!updated) throw new AppError(404, 'USER_NOT_FOUND', `User not found: ${userId}`);
    const { passwordHash: _passwordHash, ...rest } = updated;
    return rest;
  },

  /**
   * Issue a confirmation token for a destructive action.
   *
   * The token is bound to the principal, the action and the exact resource,
   * and expires quickly (MASTER PLAN §05.3).
   */
  async requestConfirmation(principal: Principal, action: string, resource: string) {
    const issued = issueConfirmToken({
      principalId: principal.principalId,
      action,
      resource,
    });
    return {
      confirmToken: issued.token,
      expiresAt: issued.expiresAt,
      action,
      resource,
    };
  },

  verifyConfirmation(input: {
    token: string;
    principalId: string;
    action: string;
    resource: string;
  }): boolean {
    return verifyConfirmToken(input);
  },

  isAuthEnabled(): boolean {
    return env.API_AUTH_ENABLED;
  },
};
