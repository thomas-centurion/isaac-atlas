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

/** Quién puede reaccionar: hace falta cuenta con username y no se puede votar la propia run. */
function useReactionAccess(run: Run) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const isOwn = me?.id === run.author.id;
  const canReact = Boolean(me?.username) && !isOwn;
  const reason = !me ? t('react.loginToVote') : isOwn ? t('react.ownRun') : undefined;
  return { canReact, reason };
}

interface VoteBoxProps {
  run: Run;
  /** Vertical (▲ puntaje ▼) para las tarjetas; horizontal para el detalle. */
  orientation?: 'vertical' | 'horizontal';
}

/** Voto a favor / en contra con el puntaje en el medio. */
export function VoteBox({ run, orientation = 'vertical' }: VoteBoxProps) {
  const { t } = useTranslation();
  const vote = useVote();
  const { canReact, reason } = useReactionAccess(run);
  const current = run.viewer?.vote ?? 0;
  const net = run.stats.up - run.stats.down;

  return (
    <div
      className={`${styles.votes} ${orientation === 'vertical' ? styles.vertical : ''}`}
      role="group"
      aria-label={t('react.votes')}
      title={reason}
    >
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
      {vote.isError ? (
        <span role="alert" className="visually-hidden">
          {t('errors.internal')}
        </span>
      ) : null}
    </div>
  );
}

/** Etiquetas de la comunidad (OP / Troll / Hard): una por usuario, con el conteo de cada una. */
export function VerdictChips({ run }: { run: Run }) {
  const { t } = useTranslation();
  const verdict = useVerdict();
  const { canReact, reason } = useReactionAccess(run);
  const current = run.viewer?.verdict ?? null;

  return (
    <div className={styles.verdicts} role="group" aria-label={t('react.verdicts')} title={reason}>
      {VERDICT_KINDS.map((kind: VerdictKind) => (
        <button
          key={kind}
          type="button"
          className={`${styles.verdict} ${styles[kind]} ${current === kind ? styles.verdictActive : ''}`}
          aria-pressed={current === kind}
          disabled={!canReact}
          onClick={() => verdict.mutate({ runId: run.id, kind: toggleVerdict(current, kind) })}
        >
          {t(`verdict.${kind}`)}
          <span className={styles.count}>{run.stats[kind]}</span>
        </button>
      ))}
      {verdict.isError ? (
        <span role="alert" className={styles.error}>
          {t('errors.internal')}
        </span>
      ) : null}
    </div>
  );
}

/** Voto y etiquetas juntos, en una fila (página de detalle de la run). */
export function VoteControls({ run }: { run: Run }) {
  return (
    <div className={styles.controls}>
      <VoteBox run={run} orientation="horizontal" />
      <VerdictChips run={run} />
    </div>
  );
}
