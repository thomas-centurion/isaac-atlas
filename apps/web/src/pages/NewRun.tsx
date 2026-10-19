import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { useCreateRun } from '../api/runs';
import { isDraftEmpty, useRunDraft } from '../runs/draft';
import { RunForm } from '../runs/RunForm';

/** Nueva run: el borrador se guarda solo en este navegador hasta que se publica. */
export function NewRun() {
  const { t } = useTranslation();
  usePageTitle(t('run.newTitle'));
  const navigate = useNavigate();
  const create = useCreateRun();
  const [draft, dispatch, clearDraft] = useRunDraft();

  return (
    <RunForm
      mode="create"
      draft={draft}
      dispatch={dispatch}
      pending={create.isPending}
      error={create.error}
      onSubmit={(input) =>
        create.mutate(input, {
          onSuccess: (run) => {
            clearDraft();
            navigate(`/runs/${run.id}`);
          },
        })
      }
      onDiscard={isDraftEmpty(draft) ? undefined : clearDraft}
    />
  );
}
