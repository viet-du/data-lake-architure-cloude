import { OperationService, type OperationOwner } from '../services';
import type {
  TCreateOperationBody,
  TOperationEventsQuery,
  TOperationIdParam,
  TOperationListQuery,
  TRetryOperationBody,
} from '../schemas';

/**
 * The unified operations controller.
 *
 * The controller is a thin adapter: it validates the request, resolves the
 * calling principal from the authenticated context, and delegates to the
 * service. No business rule lives here.
 */
export const OperationController = {
  async create(
    body: TCreateOperationBody,
    owner: OperationOwner,
    idempotencyKey?: string,
  ) {
    return OperationService.create(body, owner, idempotencyKey);
  },

  async list(query: TOperationListQuery) {
    return OperationService.list(query);
  },

  async get(params: TOperationIdParam) {
    return OperationService.getOrFail(params.operationId);
  },

  async events(params: TOperationIdParam, query: TOperationEventsQuery) {
    return OperationService.events(params.operationId, query.limit);
  },

  async cancel(params: TOperationIdParam, owner: OperationOwner) {
    return OperationService.cancel(params.operationId, owner);
  },

  async retry(
    params: TOperationIdParam,
    body: TRetryOperationBody,
    owner: OperationOwner,
    idempotencyKey?: string,
  ) {
    return OperationService.retry(params.operationId, body, owner, idempotencyKey);
  },
};
