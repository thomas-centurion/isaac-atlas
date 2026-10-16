import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodSchema } from 'zod';
import type { ApiError, ApiErrorCode } from '@isaac-atlas/shared';

const STATUS: Record<ApiErrorCode, number> = {
  validation: 400,
  invalid_credentials: 401,
  unauthorized: 401,
  forbidden: 403,
  invalid_token: 400,
  email_taken: 409,
  username_taken: 409,
  identity_in_use: 409,
  provider_unavailable: 501,
  last_login_method: 409,
  rate_limited: 429,
  not_found: 404,
  internal: 500,
};

export class HttpError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly issues?: ApiError['issues'],
  ) {
    super(code);
  }
  get status() {
    return STATUS[this.code];
  }
}

export function sendError(res: Response, code: ApiErrorCode, issues?: ApiError['issues']) {
  const body: ApiError = { error: code, ...(issues ? { issues } : {}) };
  res.status(STATUS[code]).json(body);
}

/** Express 4 no captura rechazos de handlers async: los reenviamos a next(). */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parseBody<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(
      'validation',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return sendError(res, err.code, err.issues);
  console.error('[api] unhandled error', err);
  sendError(res, 'internal');
};
