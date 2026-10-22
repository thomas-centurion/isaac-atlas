import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { useMe } from './useAuth';

/**
 * Protege rutas: sin sesión → /login; con sesión pero sin username → /welcome
 * (onboarding de cuentas creadas con Google/Steam).
 */
export function RequireAuth({ allowWithoutUsername = false }: { allowWithoutUsername?: boolean }) {
  const { t } = useTranslation();
  const { data: user, isPending, isError, refetch } = useMe();
  const location = useLocation();

  if (isPending) return null;
  // Un fallo de red no significa "sin sesión": no se manda al login a quien sí la tiene.
  if (isError) {
    return (
      <>
        <Notice tone="error">{t('errors.network')}</Notice>
        <Button onClick={() => void refetch()}>{t('errors.retry')}</Button>
      </>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.username && !allowWithoutUsername) return <Navigate to="/welcome" replace />;
  return <Outlet />;
}
