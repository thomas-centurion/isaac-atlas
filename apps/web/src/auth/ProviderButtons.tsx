import { useTranslation } from 'react-i18next';
import { AUTH_PROVIDERS, type AuthProvider } from '@isaac-atlas/shared';
import styles from './ProviderButtons.module.css';
import { providerLoginUrl, useProviders } from './useAuth';

interface ProviderButtonsProps {
  /** Proveedores que no se muestran (p. ej. los ya vinculados). */
  exclude?: AuthProvider[];
  link?: boolean;
}

/**
 * Los botones son <a> normales: el login OAuth/OpenID es una redirección completa
 * del navegador al proveedor, no una llamada fetch.
 */
export function ProviderButtons({ exclude = [], link = false }: ProviderButtonsProps) {
  const { t } = useTranslation();
  const { data: providers } = useProviders();
  const available = AUTH_PROVIDERS.filter((p) => providers?.[p] && !exclude.includes(p));
  if (available.length === 0) return null;

  return (
    <div className={styles.list}>
      {available.map((provider) => (
        <a
          key={provider}
          href={providerLoginUrl(provider, link)}
          className={`${styles.button} ${styles[provider]}`}
        >
          {t(link ? 'auth.linkWith' : 'auth.continueWith', {
            provider: t(`auth.providers.${provider}`),
          })}
        </a>
      ))}
    </div>
  );
}
