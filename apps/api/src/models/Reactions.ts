import { Schema, model, type Types } from 'mongoose';
import { VERDICT_KINDS, type VerdictKind } from '@isaac-atlas/shared';

interface VoteAttrs {
  userId: Types.ObjectId;
  runId: Types.ObjectId;
  value: 1 | -1;
}

const voteSchema = new Schema<VoteAttrs>({
  userId: { type: Schema.Types.ObjectId, required: true },
  runId: { type: Schema.Types.ObjectId, required: true },
  value: { type: Number, enum: [1, -1], required: true },
});
// Un voto por usuario y run: el índice único hace imposible votar dos veces.
voteSchema.index({ userId: 1, runId: 1 }, { unique: true });
voteSchema.index({ runId: 1 });

export const Vote = model<VoteAttrs>('Vote', voteSchema);

interface VerdictAttrs {
  userId: Types.ObjectId;
  runId: Types.ObjectId;
  kind: VerdictKind;
}

const verdictSchema = new Schema<VerdictAttrs>({
  userId: { type: Schema.Types.ObjectId, required: true },
  runId: { type: Schema.Types.ObjectId, required: true },
  kind: { type: String, enum: VERDICT_KINDS, required: true },
});
// Un veredicto por usuario y run (se puede cambiar o quitar).
verdictSchema.index({ userId: 1, runId: 1 }, { unique: true });
verdictSchema.index({ runId: 1 });

export const Verdict = model<VerdictAttrs>('Verdict', verdictSchema);

interface DailyPickAttrs {
  /** Fecha UTC "YYYY-MM-DD". */
  date: string;
  runId: Types.ObjectId;
}

const dailyPickSchema = new Schema<DailyPickAttrs>({
  date: { type: String, required: true, unique: true },
  runId: { type: Schema.Types.ObjectId, required: true },
});

export const DailyPick = model<DailyPickAttrs>('DailyPick', dailyPickSchema);
