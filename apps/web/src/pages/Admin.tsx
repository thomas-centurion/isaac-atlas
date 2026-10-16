import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAdminReports, useResolveReport } from '../api/runs';
import { useMe } from '../auth/useAuth';
import { RunCard } from '../runs/RunCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import styles from './Admin.module.css';

/** Cola de moderación: reportes abiertos. Resolver afecta a todos los reportes de esa run. */
export function Admin() {
  const { t } = useTranslation();
  usePageTitle(t('admin.title'));
  const { data: me, isPending } = useMe();
  const isAdmin = me?.role === 'admin';
  const reports = useAdminReports(isAdmin);
  const resolve = useResolveReport();
  // Borrar una run no se deshace: pide una segunda confirmación.
  const [confirming, setConfirming] = useState<string | null>(null);

  if (isPending) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <Panel as="h1" title={t('admin.title')}>
      <p>{t('admin.intro')}</p>
      {reports.isPending ? <p>{t('run.loading')}</p> : null}
      {reports.error || resolve.error ? <Notice tone="error">{t('errors.internal')}</Notice> : null}
      {reports.data?.length === 0 ? <p>{t('admin.empty')}</p> : null}

      <ul className={styles.list}>
        {reports.data?.map((report) => (
          <li key={report.id} className={styles.item}>
            <div className={styles.head}>
              <Badge tone="hard">{t(`report.reasons.${report.reason}`)}</Badge>
              <span className={styles.meta}>
                {t('admin.reportedBy', { user: report.reporter.username })}
              </span>
            </div>
            {report.details ? <p className={styles.details}>{report.details}</p> : null}
            <RunCard run={report.run} />
            <div className={styles.actions}>
              <Button
                variant="secondary"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ reportId: report.id, action: 'dismiss' })}
              >
                {t('admin.dismiss')}
              </Button>
              {confirming === report.id ? (
                <>
                  <Button
                    variant="danger"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ reportId: report.id, action: 'remove_run' })}
                  >
                    {t('run.deleteYes')}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirming(null)}>
                    {t('run.cancel')}
                  </Button>
                </>
              ) : (
                <Button variant="danger" onClick={() => setConfirming(report.id)}>
                  {t('admin.remove')}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
