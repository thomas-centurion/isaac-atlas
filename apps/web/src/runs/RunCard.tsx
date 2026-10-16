import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatSeed, getCharacter, type Run } from '@isaac-atlas/shared';
import { useLang } from '../hooks/useLang';
import { Badge } from '../ui/Badge';
import { ItemIcon } from '../ui/ItemIcon';
import { characterLabel } from './labels';
import { VoteControls } from './VoteControls';
import styles from './RunCard.module.css';

const PREVIEW_ITEMS = 10;

interface RunCardProps {
  run: Run;
  /** Muestra el autor (en "Mis runs" es redundante). */
  showAuthor?: boolean;
  /** Ítems a resaltar (los que el buscador pidió): se muestran primero en la vista previa. */
  highlight?: number[];
}

/**
 * Tarjeta de una run. Toda la tarjeta es clicable (el link de la seed se estira con ::after) y los
 * botones de voto quedan por encima: un <a> no puede contener <button>, por eso no es un solo link.
 */
export function RunCard({ run, showAuthor = true, highlight = [] }: RunCardProps) {
  const { t } = useTranslation();
  const lang = useLang();
  const character = getCharacter(run.characterId);

  // Los ítems buscados van primero para que se vea por qué la run coincide.
  const ordered = [
    ...run.items.filter((i) => highlight.includes(i.itemId)),
    ...run.items.filter((i) => !highlight.includes(i.itemId)),
  ];
  const unique = [...new Map(ordered.map((i) => [i.itemId, i])).values()];

  return (
    <article className={styles.card}>
      <div className={styles.main}>
        <Link to={`/runs/${run.id}`} className={styles.link}>
          {formatSeed(run.seed)}
        </Link>
        <span className={styles.badges}>
          {character ? <Badge tone="op">{characterLabel(character, lang, t)}</Badge> : null}
          <Badge>{t(`results.${run.outcome.result}`)}</Badge>
          {run.difficulty !== 'normal' ? <Badge>{t(`difficulty.${run.difficulty}`)}</Badge> : null}
          {!run.fullUnlocks ? <Badge tone="hard">{t('run.unlocksPartial')}</Badge> : null}
        </span>
        <span className={styles.icons}>
          {unique.slice(0, PREVIEW_ITEMS).map((it) => (
            <ItemIcon key={it.itemId} kind="item" id={it.itemId} scale={1} />
          ))}
          {unique.length > PREVIEW_ITEMS ? (
            <span className={styles.more}>+{unique.length - PREVIEW_ITEMS}</span>
          ) : null}
        </span>
      </div>

      <div className={styles.footer}>
        <VoteControls run={run} />
        {showAuthor ? (
          <span className={styles.meta}>
            {t('run.by', { user: run.author.username })} ·{' '}
            {new Date(run.createdAt).toLocaleDateString(lang)}
          </span>
        ) : null}
      </div>
    </article>
  );
}
