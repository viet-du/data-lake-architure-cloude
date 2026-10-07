import { AppError } from './app-error';

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    const idPart = identifier !== undefined ? ` '${identifier}'` : '';
    super(404, 'NOT_FOUND', `${resource}${idPart} not found`);
    this.name = 'NotFoundError';
  }
}