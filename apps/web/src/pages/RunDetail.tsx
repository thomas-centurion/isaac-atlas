import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatSeed, getCharacter } from '@isaac-atlas/shared';
import { ApiRequestError } from '../api/client';
import { useDeleteRun, useRun } from '../api/runs';
import { useMe } from '../auth/useAuth';
import { useLang } from '../hooks/useLang';
import { FloorGroups } from '../runs/FloorGroups';
import { characterLabel } from '../runs/labels';
import { ReportRun } from '../runs/ReportRun';
import { VerdictChips, VoteBox } from '../runs/VoteControls';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import styles from './RunDetail.module.css';

export function RunDetail() {
  const { t } = useTranslation();
  const lang = useLang();
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: run, isPending, error } = useRun(id);
  usePageTitle(run ? formatSeed(run.seed) : undefined);
  const { data: me } = useMe();
  const remove = useDeleteRun();
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isPending) return <p>{t('run.loading')}</p>;
  if (error || !run) {
    const notFound = error instanceof ApiRequestError && error.code === 'not_found';
    return <Notice tone="error">{t(notFound ? 'run.notFound' : 'errors.internal')}</Notice>;
  }

  const character = getCharacter(run.characterId);
  const seed = formatSeed(run.seed);
  const isOwner = me?.id === run.author.id;
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang);

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(seed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Portapapeles no disponible (contexto inseguro): el usuario puede seleccionar el texto.
    }
  };

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>
            {character ? characterLabel(character, lang, t) : null}
            {' · '}
            {t(`difficulty.${run.difficulty}`)}
          </p>
          <div className={styles.seedRow}>
            <h1 className={styles.seed}>{seed}</h1>
            <Button variant="secondary" onClick={copySeed}>
              {copied ? t('run.copied') : t('run.copySeed')}
            </Button>
          </div>
          <div className={styles.badges}>
            <Badge tone="op">{t(`results.${run.outcome.result}`)}</Badge>
            {run.outcome.lastFloor ? <Badge>{t(`floors.${run.outcome.lastFloor}`)}</Badge> : null}
            {run.outcome.finalBoss ? <Badge>{t(`bosses.${run.outcome.finalBoss}`)}</Badge> : null}
            <Badge>Rep+</Badge>
            <Badge tone={run.fullUnlocks ? 'troll' : 'hard'}>
              {t(run.fullUnlocks ? 'run.unlocksFull' : 'run.unlocksPartial')}
            </Badge>
          </div>
        </header>

        <Panel title={t('run.itemsTitle')}>
          <FloorGroups items={run.items} trinkets={run.trinkets} />
        </Panel>

        {run.notes ? (
          <Panel title={t('run.notes')}>
            <p className={styles.notes}>{run.notes}</p>
          </Panel>
        ) : null}
      </div>

      <aside className={styles.aside}>
        <section className={styles.card} aria-label={t('react.votes')}>
          <VoteBox run={run} orientation="horizontal" />
          <VerdictChips run={run} />
        </section>

        <section className={styles.card}>
          <dl className={styles.facts}>
            <div>
              <dt>{t('run.author')}</dt>
              <dd>
                <Link to={`/u/${run.author.username}`}>{run.author.username}</Link>
              </dd>
            </div>
            <div>
              <dt>{t('run.published')}</dt>
              <dd>{date(run.createdAt)}</dd>
            </div>
            {run.editedAt ? (
              <div>
                <dt>{t('run.edited')}</dt>
                <dd>{date(run.editedAt)}</dd>
              </div>
            ) : null}
          </dl>
          <Link to={`/seeds/${run.seed}`} className={styles.seedLink}>
            {t('run.allRunsOfSeed')} →
          </Link>
        </section>

        <section className={styles.card}>
          {isOwner ? (
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => navigate(`/runs/${run.id}/edit`)}>
                {t('run.edit')}
              </Button>
              {remove.error ? <Notice tone="error">{t('errors.internal')}</Notice> : null}
              {confirming ? (
                <div className={styles.confirm}>
                  <span>{t('run.confirmDelete')}</span>
                  <div className={styles.confirmButtons}>
                    <Button
                      variant="danger"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(run.id, { onSuccess: () => navigate('/runs') })}
                    >
                      {t('run.deleteYes')}
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirming(false)}>
                      {t('run.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="danger" onClick={() => setConfirming(true)}>
                  {t('run.delete')}
                </Button>
              )}
            </div>
          ) : (
            <ReportRun run={run} />
          )}
        </section>
      </aside>
    </div>
  );
}
