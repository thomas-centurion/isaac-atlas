import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatSeed, getCharacter } from '@isaac-atlas/shared';
import { useMyRuns } from '../api/runs';
import { useLang } from '../hooks/useLang';
import { characterLabel } from '../runs/labels';
import { Badge } from '../ui/Badge';
import { ItemIcon } from '../ui/ItemIcon';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import styles from './MyRuns.module.css';

const PREVIEW_ITEMS = 10;

export function MyRuns() {
  const { t } = useTranslation();
  const lang = useLang();
  const { data: runs, isPending, error } = useMyRuns();

  return (
    <Panel title={t('run.myRuns')}>
      <p>
        <Link to="/runs/new">{t('run.newCta')}</Link>
      </p>
      {isPending ? <p>{t('run.loading')}</p> : null}
      {error ? <Notice tone="error">{t('errors.internal')}</Notice> : null}
      {runs?.length === 0 ? <p>{t('run.emptyMine')}</p> : null}

      <ul className={styles.list}>
        {runs?.map((run) => {
          const character = getCharacter(run.characterId);
          return (
            <li key={run.id}>
              <Link to={`/runs/${run.id}`} className={styles.card}>
                <span className={styles.seed}>{formatSeed(run.seed)}</span>
                <span className={styles.badges}>
                  {character ? <Badge tone="op">{characterLabel(character, lang, t)}</Badge> : null}
                  <Badge>{t(`results.${run.outcome.result}`)}</Badge>
                </span>
                <span className={styles.icons}>
                  {run.items.slice(0, PREVIEW_ITEMS).map((it, i) => (
                    <ItemIcon key={i} kind="item" id={it.itemId} scale={1} />
                  ))}
                  {run.items.length > PREVIEW_ITEMS ? (
                    <span className={styles.more}>+{run.items.length - PREVIEW_ITEMS}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
