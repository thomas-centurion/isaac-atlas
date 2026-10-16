import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatSeed, getCharacter } from '@isaac-atlas/shared';
import { ApiRequestError } from '../api/client';
import { useDeleteRun, useRun } from '../api/runs';
import { useMe } from '../auth/useAuth';
import { useLang } from '../hooks/useLang';
import { FloorGroups } from '../runs/FloorGroups';
import { characterLabel } from '../runs/labels';
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
    <>
      <Panel>
        <div className={styles.head}>
          <h1 className={styles.seed}>{seed}</h1>
          <Button variant="secondary" onClick={copySeed}>
            {copied ? t('run.copied') : t('run.copySeed')}
          </Button>
        </div>
        <div className={styles.badges}>
          {character ? <Badge tone="op">{characterLabel(character, lang, t)}</Badge> : null}
          <Badge>{t(`difficulty.${run.difficulty}`)}</Badge>
          <Badge>Rep+</Badge>
          <Badge tone={run.fullUnlocks ? 'troll' : 'hard'}>
            {t(run.fullUnlocks ? 'run.unlocksFull' : 'run.unlocksPartial')}
          </Badge>
        </div>
        <p>
          {t(`results.${run.outcome.result}`)}
          {run.outcome.lastFloor ? ` · ${t(`floors.${run.outcome.lastFloor}`)}` : ''}
          {run.outcome.finalBoss ? ` · ${t(`bosses.${run.outcome.finalBoss}`)}` : ''}
        </p>
        <p>
          <Link to={`/seeds/${run.seed}`}>{t('run.allRunsOfSeed')}</Link>
        </p>
        <p className={styles.meta}>
          {t('run.by', { user: run.author.username })} ·{' '}
          {new Date(run.createdAt).toLocaleDateString(lang)}
        </p>
        {run.notes ? <p className={styles.notes}>{run.notes}</p> : null}
      </Panel>

      <Panel title={t('run.itemsTitle')}>
        <FloorGroups items={run.items} trinkets={run.trinkets} />
      </Panel>

      {isOwner ? (
        <Panel>
          {remove.error ? <Notice tone="error">{t('errors.internal')}</Notice> : null}
          {confirming ? (
            <div className={styles.confirm}>
              <span>{t('run.confirmDelete')}</span>
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
          ) : (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              {t('run.delete')}
            </Button>
          )}
        </Panel>
      ) : null}

      <Link to="/runs">{t('run.backToRuns')}</Link>
    </>
  );
}
