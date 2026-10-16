import { useTranslation } from 'react-i18next';
import { VERDICT_KINDS, type Run, type VerdictKind } from '@isaac-atlas/shared';
import { useVerdict, useVote } from '../api/runs';
import { useMe } from '../auth/useAuth';
import { toggleVerdict, toggleVote } from './reactions';
import styles from './VoteControls.module.css';

/** Pixel art de las flechas (SVG inline, sin glifos de fuente que puedan faltar). */
function Arrow({ down }: { down?: boolean }) {
  return (
    <svg
      viewBox="0 0 9 6"
      width="18"
      height="12"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={down ? styles.arrowDown : undefined}
    >
      <path d="M4 0h1v1h1v1h1v1h1v1h1v1H0V4h1V3h1V2h1V1h1z" fill="currentColor" />
    </svg>
  );
}

/** Voto (▲/▼) y veredicto de la comunidad (OP / Troll / Hard) de una run. */
export function VoteControls({ run }: { run: Run }) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const vote = useVote();
  const verdict = useVerdict();

  const isOwn = me?.id === run.author.id;
  const canReact = Boolean(me?.username) && !isOwn;
  const reason = !me ? t('react.loginToVote') : isOwn ? t('react.ownRun') : undefined;

  const current = run.viewer?.vote ?? 0;
  const currentVerdict = run.viewer?.verdict ?? null;
  const net = run.stats.up - run.stats.down;

  return (
    <div className={styles.controls}>
      <div className={styles.votes} role="group" aria-label={t('react.votes')} title={reason}>
        <button
          type="button"
          className={`${styles.vote} ${current === 1 ? styles.upActive : ''}`}
          aria-pressed={current === 1}
          aria-label={t('react.upvote')}
          disabled={!canReact}
          onClick={() => vote.mutate({ runId: run.id, value: toggleVote(current, 1) })}
        >
          <Arrow />
        </button>
        <span className={styles.score} aria-label={t('react.score', { count: net })}>
          {net}
        </span>
        <button
          type="button"
          className={`${styles.vote} ${current === -1 ? styles.downActive : ''}`}
          aria-pressed={current === -1}
          aria-label={t('react.downvote')}
          disabled={!canReact}
          onClick={() => vote.mutate({ runId: run.id, value: toggleVote(current, -1) })}
        >
          <Arrow down />
        </button>
      </div>

      <div className={styles.verdicts} role="group" aria-label={t('react.verdicts')} title={reason}>
        {VERDICT_KINDS.map((kind: VerdictKind) => (
          <button
            key={kind}
            type="button"
            className={`${styles.verdict} ${styles[kind]} ${currentVerdict === kind ? styles.verdictActive : ''}`}
            aria-pressed={currentVerdict === kind}
            disabled={!canReact}
            onClick={() =>
              verdict.mutate({ runId: run.id, kind: toggleVerdict(currentVerdict, kind) })
            }
          >
            {t(`verdict.${kind}`)}
            <span className={styles.count}>{run.stats[kind]}</span>
          </button>
        ))}
      </div>

      {vote.isError || verdict.isError ? (
        <span role="alert" className={styles.error}>
          {t('errors.internal')}
        </span>
      ) : null}
    </div>
  );
}
