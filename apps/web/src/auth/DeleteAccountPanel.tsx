import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { TextField } from '../ui/TextField';
import { errorMessage } from './errors';
import { useClearSession, useDeleteAccount } from './useAuth';
import styles from './auth.module.css';

interface DeleteAccountPanelProps {
  username: string | null;
  hasPassword: boolean;
}

/**
 * "Zona de peligro": borrar la cuenta es irreversible, así que se pide una confirmación que no se
 * pueda hacer por accidente (la contraseña, o el username si la cuenta entra solo con Google/Steam).
 */
export function DeleteAccountPanel({ username, hasPassword }: DeleteAccountPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const del = useDeleteAccount();
  const clearSession = useClearSession();
  const [confirm, setConfirm] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!confirm) return;
    del.mutate(confirm, {
      onSuccess: () => {
        navigate('/?account=deleted', { replace: true });
        clearSession();
      },
    });
  };

  return (
    <Panel title={t('account.deleteTitle')}>
      <p>{t('account.deleteBody')}</p>
      {del.error ? <Notice tone="error">{errorMessage(t, del.error)}</Notice> : null}
      <form onSubmit={onSubmit} className={styles.danger}>
        <TextField
          label={
            hasPassword
              ? t('account.confirmPassword')
              : t('account.confirmUsername', { username: username ?? '' })
          }
          type={hasPassword ? 'password' : 'text'}
          autoComplete={hasPassword ? 'current-password' : 'off'}
          spellCheck={false}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <Button type="submit" variant="danger" disabled={!confirm || del.isPending}>
          {t('account.deleteSubmit')}
        </Button>
      </form>
    </Panel>
  );
}
