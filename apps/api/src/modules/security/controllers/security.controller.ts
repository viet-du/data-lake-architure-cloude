import { AppError } from '@/errors';
import { AuthService, AuditService } from '../services';
import type {
  TAuditListQuery,
  TConfirmBody,
  TCreateUserBody,
  TLoginBody,
  TUpdateUserBody,
  TUserIdParam,
} from '../schemas';
import type { Principal } from '../types';

export const AuthController = {
  async login(body: TLoginBody) {
    return AuthService.login(body.email, body.password);
  },

  /**
   * Issue a confirmation token for a destructive operation.
   *
   * The principal comes from the request context, so a confirmation can
   * never be issued for another identity.
   */
  async confirm(principal: Principal, body: TConfirmBody) {
    if (!principal || principal.synthetic) {
      throw new AppError(
        401,
        'UNAUTHORIZED',
        'A confirmed identity is required to request a confirmation token.',
      );
    }
    return AuthService.requestConfirmation(principal, body.action, body.resource);
  },
};

export const UserController = {
  async list() {
    const items = await AuthService.listUsers();
    return { total: items.length, items };
  },

  async get(params: TUserIdParam) {
    return AuthService.getUser(params.userId);
  },

  async create(body: TCreateUserBody) {
    return AuthService.createUser({
      email: body.email,
      displayName: body.displayName,
      role: body.role,
      password: body.password,
      scopes: body.scopes,
    });
  },

  async update(params: TUserIdParam, body: TUpdateUserBody) {
    return AuthService.updateUser(params.userId, body);
  },
};

export const AuditController = {
  async list(query: TAuditListQuery) {
    return AuditService.list({
      limit: query.limit,
      offset: query.offset,
      ...(query.principalId !== undefined ? { principalId: query.principalId } : {}),
      ...(query.action !== undefined ? { action: query.action } : {}),
      ...(query.outcome !== undefined ? { outcome: query.outcome } : {}),
      ...(query.resource !== undefined ? { resource: query.resource } : {}),
    });
  },
};
