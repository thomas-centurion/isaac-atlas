import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from './useAuth';

/**
 * Protege rutas: sin sesión → /login; con sesión pero sin username → /welcome
 * (onboarding de cuentas creadas con Google/Steam).
 */
export function RequireAuth({ allowWithoutUsername = false }: { allowWithoutUsername?: boolean }) {
  const { data: user, isPending } = useMe();
  const location = useLocation();

  if (isPending) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.username && !allowWithoutUsername) return <Navigate to="/welcome" replace />;
  return <Outlet />;
}
