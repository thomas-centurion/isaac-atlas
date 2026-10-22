import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AuthProvider,
  type LoginInput,
  type MeResponse,
  type ProvidersResponse,
  type PublicUser,
  type RegisterInput,
  type SetUsernameInput,
} from '@isaac-atlas/shared';
import { api } from '../api/client';
import i18n from '../i18n';

const ME_KEY = ['auth', 'me'] as const;

const currentLocale = () => (i18n.language.startsWith('es') ? 'es' : 'en');

/** Usuario logueado (o null). `undefined` mientras carga. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => (await api<MeResponse>('/auth/me')).user,
    staleTime: 60_000,
  });
}

export function useProviders() {
  return useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: () => api<ProvidersResponse>('/auth/providers'),
    staleTime: Infinity,
  });
}

/** Mutación que deja el usuario resultante en la caché de /me. */
function useUserMutation<V>(fn: (vars: V) => Promise<{ user: PublicUser }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: ({ user }) => qc.setQueryData(ME_KEY, user),
  });
}

export const useLogin = () =>
  useUserMutation((input: LoginInput) =>
    api<{ user: PublicUser }>('/auth/login', { method: 'POST', body: input }),
  );

export const useRegister = () =>
  useUserMutation((input: Omit<RegisterInput, 'locale'>) =>
    api<{ user: PublicUser }>('/auth/register', {
      method: 'POST',
      body: { ...input, locale: currentLocale() },
    }),
  );

export const useSetUsername = () =>
  useUserMutation((input: SetUsernameInput) =>
    api<{ user: PublicUser }>('/auth/username', { method: 'POST', body: input }),
  );

export const useUnlink = () =>
  useUserMutation((provider: AuthProvider) =>
    api<{ user: PublicUser }>(`/auth/identities/${provider}`, { method: 'DELETE' }),
  );

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    // También se vacía la caché: votos propios, "Mis runs", etc. no deben verlos otros en el mismo navegador.
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(ME_KEY, null);
    },
  });
}

export const useForgotPassword = () =>
  useMutation({
    mutationFn: (email: string) =>
      api('/auth/forgot', { method: 'POST', body: { email, locale: currentLocale() } }),
  });

export const useResetPassword = () =>
  useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      api('/auth/reset', { method: 'POST', body: input }),
  });

export function useVerifyEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api('/auth/verify-email', { method: 'POST', body: { token } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_KEY }),
  });
}

/** Borra la cuenta (irreversible): confirma con la contraseña o, sin contraseña, con el username. */
export const useDeleteAccount = () =>
  useMutation({
    mutationFn: (confirm: string) => api('/account', { method: 'DELETE', body: { confirm } }),
  });

/**
 * Descarta todo lo cacheado de la sesión (usuario, runs propias, votos…). Va aparte de la mutación
 * a propósito: si se limpia antes de navegar, la ruta protegida en la que se está redirige a /login
 * y pisa la navegación a la portada.
 */
export function useClearSession() {
  const qc = useQueryClient();
  return () => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
    qc.setQueryData(ME_KEY, null);
  };
}

export const useResendVerification = () =>
  useMutation({
    mutationFn: () =>
      api('/auth/resend-verification', { method: 'POST', body: { locale: currentLocale() } }),
  });

/** Los flujos OAuth son redirecciones completas del navegador, no fetch. */
export const providerLoginUrl = (provider: AuthProvider, link = false) =>
  `/api/auth/${provider}${link ? '?link=1' : ''}`;
