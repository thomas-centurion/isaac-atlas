import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatSeed, getCharacter, type Run } from '@isaac-atlas/shared';
import { useLang } from '../hooks/useLang';
import { Badge } from '../ui/Badge';
import { ItemIcon } from '../ui/ItemIcon';
import { characterLabel } from './labels';
import { VerdictChips, VoteBox } from './VoteControls';
import styles from './RunCard.module.css';

const PREVIEW_ITEMS = 12;

interface RunCardProps {
  run: Run;
  /** Muestra el autor (en "Mis runs" es redundante). */
  showAuthor?: boolean;
  /** Ítems a resaltar (los que el buscador pidió): van primero y con el marco dorado. */
  highlight?: number[];
  /** Variante destacada (la seed del día). */
  featured?: boolean;
}

/**
 * Tarjeta de una run. Toda la tarjeta es clicable (el link de la seed se estira con ::after) y lo
 * interactivo queda por encima: un <a> no puede contener <button>, por eso no es un solo link.
 */
export function RunCard({
  run,
  showAuthor = true,
  highlight = [],
  featured = false,
}: RunCardProps) {
  const { t } = useTranslation();
  const lang = useLang();
  const character = getCharacter(run.characterId);

  // Los ítems buscados van primero para que se vea por qué la run coincide.
  const ordered = [
    ...run.items.filter((i) => highlight.includes(i.itemId)),
    ...run.items.filter((i) => !highlight.includes(i.itemId)),
  ];
  const unique = [...new Map(ordered.map((i) => [i.itemId, i])).values()];
  const hidden = unique.length - PREVIEW_ITEMS;

  return (
    <article className={`${styles.card} ${featured ? styles.featured : ''}`}>
      <div className={styles.votes}>
        <VoteBox run={run} />
      </div>

      <div className={styles.body}>
        <div className={styles.head}>
          <Link to={`/runs/${run.id}`} className={styles.link}>
            {formatSeed(run.seed)}
          </Link>
          <span className={styles.badges}>
            {character ? <Badge tone="op">{characterLabel(character, lang, t)}</Badge> : null}
            <Badge>{t(`results.${run.outcome.result}`)}</Badge>
            {run.difficulty !== 'normal' ? (
              <Badge>{t(`difficulty.${run.difficulty}`)}</Badge>
            ) : null}
            {!run.fullUnlocks ? <Badge tone="hard">{t('run.unlocksPartial')}</Badge> : null}
          </span>
        </div>

        <div className={styles.slots}>
          {unique.slice(0, PREVIEW_ITEMS).map((it) => (
            <span
              key={it.itemId}
              className={`${styles.slot} ${highlight.includes(it.itemId) ? styles.hit : ''}`}
            >
              <ItemIcon kind="item" id={it.itemId} scale={1} />
            </span>
          ))}
          {hidden > 0 ? <span className={styles.more}>+{hidden}</span> : null}
        </div>

        <div className={styles.foot}>
          <VerdictChips run={run} />
          {showAuthor ? (
            <span className={styles.meta}>
              {t('run.byPrefix')}{' '}
              <Link to={`/u/${run.author.username}`}>{run.author.username}</Link> ·{' '}
              {new Date(run.createdAt).toLocaleDateString(lang)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
