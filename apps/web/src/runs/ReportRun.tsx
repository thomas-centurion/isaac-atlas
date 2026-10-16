import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAX_REPORT_DETAILS,
  REPORT_REASONS,
  type ReportReason,
  type Run,
} from '@isaac-atlas/shared';
import { useReportRun } from '../api/runs';
import { errorMessage } from '../auth/errors';
import { useMe } from '../auth/useAuth';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';

/** "Reportar": solo para usuarios con cuenta que no son el autor. Abre un formulario corto. */
export function ReportRun({ run }: { run: Run }) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const report = useReportRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');

  if (!me?.username || me.id === run.author.id) return null;

  if (report.isSuccess) return <Notice tone="success">{t('report.sent')}</Notice>;

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t('report.open')}
      </Button>
    );
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    report.mutate({ runId: run.id, reason, details });
  };

  return (
    <form onSubmit={onSubmit}>
      <h3>{t('report.title')}</h3>
      {report.error ? <Notice tone="error">{errorMessage(t, report.error)}</Notice> : null}
      <Select
        label={t('report.reason')}
        value={reason}
        onChange={(e) => setReason(e.target.value as ReportReason)}
      >
        {REPORT_REASONS.map((r) => (
          <option key={r} value={r}>
            {t(`report.reasons.${r}`)}
          </option>
        ))}
      </Select>
      <TextArea
        label={t('report.details')}
        hint={`${details.length}/${MAX_REPORT_DETAILS}`}
        maxLength={MAX_REPORT_DETAILS}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
      />
      <Button type="submit" disabled={report.isPending}>
        {t('report.send')}
      </Button>{' '}
      <Button variant="secondary" onClick={() => setOpen(false)}>
        {t('run.cancel')}
      </Button>
    </form>
  );
}
