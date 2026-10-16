import { config } from '../config.js';
import type { ProviderProfile } from './accounts.js';

const OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

type Fetch = typeof fetch;

/** URL a la que redirigimos al usuario para que inicie sesión en Steam (OpenID 2.0). */
export function buildSteamLoginUrl(returnTo: string, realm: string): string {
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': IDENTIFIER_SELECT,
    'openid.claimed_id': IDENTIFIER_SELECT,
  });
  return `${OPENID_ENDPOINT}?${params.toString()}`;
}

/**
 * Verifica la respuesta de Steam y devuelve el SteamID64, o null si es inválida.
 * Steam confirma la firma vía `check_authentication` (y consume el nonce, lo que
 * impide reutilizar la misma respuesta).
 */
export async function verifySteamAssertion(
  query: Record<string, unknown>,
  expectedReturnTo: string,
  fetchImpl: Fetch = fetch,
): Promise<string | null> {
  const get = (k: string) => (typeof query[k] === 'string' ? (query[k] as string) : undefined);

  if (get('openid.ns') !== OPENID_NS) return null;
  if (get('openid.mode') !== 'id_res') return null;
  if (get('openid.op_endpoint') !== OPENID_ENDPOINT) return null;
  if (get('openid.return_to') !== expectedReturnTo) return null;

  const steamId = CLAIMED_ID.exec(get('openid.claimed_id') ?? '')?.[1];
  if (!steamId || get('openid.identity') !== get('openid.claimed_id')) return null;

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('openid.') && typeof value === 'string') body.set(key, value);
  }
  body.set('openid.mode', 'check_authentication');

  try {
    const res = await fetchImpl(OPENID_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    return /^is_valid\s*:\s*true\s*$/m.test(text) ? steamId : null;
  } catch {
    return null;
  }
}

/** Avatar del perfil público (opcional: requiere STEAM_API_KEY). */
export async function fetchSteamAvatar(
  steamId: string,
  fetchImpl: Fetch = fetch,
): Promise<string | undefined> {
  if (!config.STEAM_API_KEY) return undefined;
  try {
    const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
    url.searchParams.set('key', config.STEAM_API_KEY);
    url.searchParams.set('steamids', steamId);
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { response?: { players?: { avatarfull?: string }[] } };
    return data.response?.players?.[0]?.avatarfull;
  } catch {
    return undefined;
  }
}

export const steamProfile = (steamId: string, avatar?: string): ProviderProfile => ({
  provider: 'steam',
  providerId: steamId,
  // Steam no entrega email.
  emailVerified: false,
  ...(avatar ? { avatar } : {}),
});
