import type { TFunction } from 'i18next';
import { API_ERROR_CODES } from '@isaac-atlas/shared';
import { ApiRequestError } from '../api/client';

const KNOWN = new Set<string>(API_ERROR_CODES);

/** Código de error → mensaje traducido (para errores de API y para `?error=` de los redirects OAuth). */
export function errorMessage(t: TFunction, error: unknown): string {
  const code =
    error instanceof ApiRequestError ? error.code : typeof error === 'string' ? error : 'internal';
  return t(`errors.${KNOWN.has(code) || code === 'oauth_failed' ? code : 'internal'}`);
}

/** Errores de validación por campo (path → mensaje traducido genérico). */
export function fieldErrors(error: unknown): Record<string, true> {
  if (!(error instanceof ApiRequestError) || error.code !== 'validation') return {};
  return Object.fromEntries((error.issues ?? []).map((i) => [i.path, true as const]));
}
