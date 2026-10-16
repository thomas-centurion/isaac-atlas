import { Types } from 'mongoose';
import { HttpError } from './http.js';

export interface Cursor {
  createdAt: Date;
  id: Types.ObjectId;
  /** Valor del campo de orden (hot / wilson). Ausente al ordenar por fecha. */
  value?: number;
}

/** Cursor opaco para paginar por (createdAt, _id): estable aunque lleguen runs nuevas. */
export function encodeCursor({ createdAt, id, value }: Cursor): string {
  const payload = {
    t: createdAt.getTime(),
    id: id.toHexString(),
    ...(value !== undefined ? { v: value } : {}),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  try {
    const { t, id, v } = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      t: unknown;
      id: unknown;
      v?: unknown;
    };
    if (typeof t !== 'number' || !Number.isFinite(t)) throw new Error('bad time');
    if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) throw new Error('bad id');
    if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v))) throw new Error('bad v');
    return {
      createdAt: new Date(t),
      id: new Types.ObjectId(id),
      ...(v !== undefined ? { value: v as number } : {}),
    };
  } catch {
    throw new HttpError('validation', [{ path: 'cursor', message: 'invalid cursor' }]);
  }
}
