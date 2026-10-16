import { apiErrorSchema, type ApiError, type ApiErrorCode } from '@isaac-atlas/shared';

export class ApiRequestError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly issues: ApiError['issues'],
    readonly status: number,
  ) {
    super(code);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
}

/** fetch contra /api (mismo origen: el proxy de Vite en dev) que lanza ApiRequestError. */
export async function api<T = void>(path: string, { method = 'GET', body }: RequestOptions = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;

  const parsed = apiErrorSchema.safeParse(await res.json().catch(() => null));
  throw new ApiRequestError(
    parsed.success ? parsed.data.error : 'internal',
    parsed.success ? parsed.data.issues : undefined,
    res.status,
  );
}
