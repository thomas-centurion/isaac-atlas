import { Schema, model, type Types } from 'mongoose';

export type EmailTokenKind = 'verify' | 'reset';

interface EmailTokenAttrs {
  userId: Types.ObjectId;
  kind: EmailTokenKind;
  /** SHA-256 del token; el token en claro solo viaja por mail. */
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const schema = new Schema<EmailTokenAttrs>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  kind: { type: String, enum: ['verify', 'reset'], required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: () => new Date() },
});
// Mongo borra el documento cuando expiresAt queda en el pasado.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailToken = model<EmailTokenAttrs>('EmailToken', schema);
