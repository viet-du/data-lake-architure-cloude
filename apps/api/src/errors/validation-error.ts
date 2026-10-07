import { AppError } from './app-error';
import type { ZodIssue } from 'zod';

export class ValidationError extends AppError {
  constructor(issues: ZodIssue[] | string) {
    super(400, 'VALIDATION_ERROR', 'Request validation failed', issues);
    this.name = 'ValidationError';
  }
}