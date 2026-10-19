import { useReducer } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Run } from '@isaac-atlas/shared';
import { useRun, useUpdateRun } from '../api/runs';
import { useMe } from '../auth/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import { draftReducer, runToDraft } from '../runs/draft';
import { RunForm } from '../runs/RunForm';
import { Notice } from '../ui/Notice';

/** Editar una run propia. A diferencia de "Nueva run", no hay borrador guardado: se parte de la run. */
export function EditRun() {
  const { t } = useTranslation();
  usePageTitle(t('run.editTitle'));
  const { id } = useParams();
  const { data: run, isPending, error } = useRun(id);
  const { data: me } = useMe();

  if (isPending) return <p>{t('run.loading')}</p>;
  if (error || !run) return <Notice tone="error">{t('run.notFound')}</Notice>;
  // Solo el autor edita (la API lo exige igual: esto evita mostrar un formulario inútil).
  if (me?.id !== run.author.id) return <Navigate to={`/runs/${run.id}`} replace />;

  return <EditRunForm run={run} />;
}

function EditRunForm({ run }: { run: Run }) {
  const navigate = useNavigate();
  const update = useUpdateRun(run.id);
  // useReducer con inicializador: el estado parte de la run y después lo manda el usuario.
  const [draft, dispatch] = useReducer(draftReducer, run, runToDraft);

  return (
    <RunForm
      mode="edit"
      draft={draft}
      dispatch={dispatch}
      pending={update.isPending}
      error={update.error}
      onSubmit={(input) => update.mutate(input, { onSuccess: () => navigate(`/runs/${run.id}`) })}
      onCancel={() => navigate(`/runs/${run.id}`)}
    />
  );
}
