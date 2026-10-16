import { useTranslation } from 'react-i18next';
import { ProviderButtons } from './ProviderButtons';
import styles from './auth.module.css';
import { useProviders } from './useAuth';

/** Google arriba, separador "o" y Steam abajo. Con un solo proveedor, el separador va arriba. */
export function SocialLogin() {
  const { t } = useTranslation();
  const { data: providers } = useProviders();
  if (!providers || (!providers.google && !providers.steam)) return null;

  const divider = <p className={styles.divider}>{t('auth.or')}</p>;

  if (providers.google && providers.steam) {
    return (
      <>
        <ProviderButtons only={['google']} />
        {divider}
        <ProviderButtons only={['steam']} />
      </>
    );
  }
  return (
    <>
      {divider}
      <ProviderButtons />
    </>
  );
}
