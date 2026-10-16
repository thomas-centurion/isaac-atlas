import { Types } from 'mongoose';
import { HttpError } from './http.js';

export interface Cursor {
  createdAt: Date;
  id: Types.ObjectId;
}

/** Cursor opaco para paginar por (createdAt, _id): estable aunque lleguen runs nuevas. */
export function encodeCursor({ createdAt, id }: Cursor): string {
  return Buffer.from(JSON.stringify({ t: createdAt.getTime(), id: id.toHexString() })).toString(
    'base64url',
  );
}

export function decodeCursor(raw: string): Cursor {
  try {
    const { t, id } = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      t: unknown;
      id: unknown;
    };
    if (typeof t !== 'number' || !Number.isFinite(t)) throw new Error('bad time');
    if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) throw new Error('bad id');
    return { createdAt: new Date(t), id: new Types.ObjectId(id) };
  } catch {
    throw new HttpError('validation', [{ path: 'cursor', message: 'invalid cursor' }]);
  }
}
