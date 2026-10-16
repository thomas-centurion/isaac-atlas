import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatSeed, getCharacter, isValidSeedFormat } from '@isaac-atlas/shared';
import { ApiRequestError } from '../api/client';
import { useSeedSummary } from '../api/runs';
import { useLang } from '../hooks/useLang';
import { characterLabel } from '../runs/labels';
import { RunCard } from '../runs/RunCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ItemIcon } from '../ui/ItemIcon';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { getItem } from '../catalog';
import styles from './SeedPage.module.css';

/** Todo lo que la comunidad registró para una seed. */
export function SeedPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const { seed } = useParams();
  const { data, isPending, error } = useSeedSummary(seed);
  usePageTitle(data ? formatSeed(data.seed) : undefined);
  const [copied, setCopied] = useState(false);

  if (!seed || !isValidSeedFormat(seed)) return <Notice tone="error">{t('seed.notFound')}</Notice>;
  if (isPending) return <p>{t('run.loading')}</p>;
  if (error || !data) {
    const notFound = error instanceof ApiRequestError && error.code === 'not_found';
    return <Notice tone="error">{t(notFound ? 'seed.notFound' : 'errors.internal')}</Notice>;
  }

  const pretty = formatSeed(data.seed);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pretty);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Portapapeles no disponible: el texto está seleccionable.
    }
  };

  return (
    <>
      <Panel>
        <div className={styles.head}>
          <h1 className={styles.seed}>{pretty}</h1>
          <Button variant="secondary" onClick={copy}>
            {copied ? t('run.copied') : t('run.copySeed')}
          </Button>
        </div>
        <p>{t('seed.runCount', { count: data.runCount })}</p>
        <div className={styles.badges}>
          {data.characters.map(({ characterId, count }) => {
            const character = getCharacter(characterId);
            return character ? (
              <Link key={characterId} to={`/?character=${characterId}&seed=${data.seed}`}>
                <Badge tone="op">
                  {characterLabel(character, lang, t)} ×{count}
                </Badge>
              </Link>
            ) : null;
          })}
        </div>
      </Panel>

      <Panel title={t('seed.topItems')}>
        <p className={styles.hint}>{t('seed.topItemsHint')}</p>
        <ul className={styles.items}>
          {data.topItems.map(({ itemId, count }) => (
            <li key={itemId} className={styles.item}>
              <ItemIcon kind="item" id={itemId} />
              <span>{getItem(itemId)?.name[lang]}</span>
              <Badge>
                {count}/{data.runCount}
              </Badge>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={t('seed.runs')}>
        <ul className={styles.runs}>
          {data.runs.map((run) => (
            <li key={run.id}>
              <RunCard run={run} />
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
