import { z } from 'zod';
import { SECURITY_ROLES } from '../types';

export const LoginBodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(512),
});

export type TLoginBody = z.infer<typeof LoginBodySchema>;

export const ConfirmBodySchema = z.object({
  action: z.string().min(1).max(120),
  resource: z.string().min(1).max(512),
});

export type TConfirmBody = z.infer<typeof ConfirmBodySchema>;

export const CreateUserBodySchema = z.object({
  email: z.string().email().max(320),
  displayName: z.string().min(1).max(120),
  role: z.enum(SECURITY_ROLES),
  password: z.string().min(12).max(512),
  scopes: z.array(z.string().min(1).max(255)).max(50).default([]),
});

export type TCreateUserBody = z.infer<typeof CreateUserBodySchema>;

export const UpdateUserBodySchema = z
  .object({
    displayName: z.string().min(1).max(120).optional(),
    role: z.enum(SECURITY_ROLES).optional(),
    scopes: z.array(z.string().min(1).max(255)).max(50).optional(),
    disabled: z.boolean().optional(),
    password: z.string().min(12).max(512).optional(),
  })
  .strict();

export type TUpdateUserBody = z.infer<typeof UpdateUserBodySchema>;

export const UserIdParamSchema = z.object({
  userId: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/, 'userId must be alphanumeric with _ -'),
});

export type TUserIdParam = z.infer<typeof UserIdParamSchema>;

export const AuditListQuerySchema = z.object({
  principalId: z.string().max(120).optional(),
  action: z.string().max(120).optional(),
  outcome: z.enum(['success', 'failure', 'denied']).optional(),
  resource: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TAuditListQuery = z.infer<typeof AuditListQuerySchema>;
