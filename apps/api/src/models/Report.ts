import { Schema, model, type Types } from 'mongoose';
import {
  REPORT_REASONS,
  REPORT_STATUSES,
  type ReportReason,
  type ReportStatus,
} from '@isaac-atlas/shared';

interface ReportAttrs {
  userId: Types.ObjectId;
  runId: Types.ObjectId;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  createdAt: Date;
}

const reportSchema = new Schema<ReportAttrs>({
  userId: { type: Schema.Types.ObjectId, required: true },
  runId: { type: Schema.Types.ObjectId, required: true },
  reason: { type: String, enum: REPORT_REASONS, required: true },
  details: { type: String, default: '' },
  status: { type: String, enum: REPORT_STATUSES, default: 'open' },
  createdAt: { type: Date, default: Date.now },
});
// Un reporte por usuario y run: un mismo usuario no puede ocultar una run repitiéndolo.
reportSchema.index({ userId: 1, runId: 1 }, { unique: true });
reportSchema.index({ runId: 1, status: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

export const Report = model<ReportAttrs>('Report', reportSchema);
