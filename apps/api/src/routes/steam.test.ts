import { describe, expect, it, vi } from 'vitest';
import { buildSteamLoginUrl, verifySteamAssertion } from '../auth/steam.js';

const RETURN_TO = 'http://localhost:5173/api/auth/steam/callback?s=abc';
const STEAM_ID = '76561198012345678';

const validQuery = (over: Record<string, string> = {}) => ({
  'openid.ns': 'http://specs.openid.net/auth/2.0',
  'openid.mode': 'id_res',
  'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
  'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
  'openid.identity': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
  'openid.return_to': RETURN_TO,
  'openid.response_nonce': '2026-10-16T00:00:00Zabc',
  'openid.assoc_handle': '1234567890',
  'openid.signed': 'signed',
  'openid.sig': 'sig',
  ...over,
});

const steamSays = (text: string) =>
  vi.fn(async () => new Response(text)) as unknown as typeof fetch;

describe('verifySteamAssertion', () => {
  it('devuelve el SteamID cuando Steam confirma la firma', async () => {
    const fetchImpl = steamSays('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n');
    expect(await verifySteamAssertion(validQuery(), RETURN_TO, fetchImpl)).toBe(STEAM_ID);

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { body: URLSearchParams },
    ];
    expect(init.body.get('openid.mode')).toBe('check_authentication');
  });

  it('rechaza si Steam dice is_valid:false', async () => {
    const result = await verifySteamAssertion(
      validQuery(),
      RETURN_TO,
      steamSays('is_valid:false\n'),
    );
    expect(result).toBeNull();
  });

  it('rechaza un return_to distinto sin llamar a Steam', async () => {
    const fetchImpl = steamSays('is_valid:true');
    const q = validQuery({ 'openid.return_to': 'https://evil.example/cb' });
    expect(await verifySteamAssertion(q, RETURN_TO, fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rechaza claimed_id que no es de steamcommunity', async () => {
    const q = validQuery({
      'openid.claimed_id': `https://evil.example/openid/id/${STEAM_ID}`,
      'openid.identity': `https://evil.example/openid/id/${STEAM_ID}`,
    });
    expect(await verifySteamAssertion(q, RETURN_TO, steamSays('is_valid:true'))).toBeNull();
  });

  it('rechaza un op_endpoint ajeno', async () => {
    const q = validQuery({ 'openid.op_endpoint': 'https://evil.example/openid/login' });
    expect(await verifySteamAssertion(q, RETURN_TO, steamSays('is_valid:true'))).toBeNull();
  });

  it('devuelve null si falla la red', async () => {
    const failing = vi.fn(async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    expect(await verifySteamAssertion(validQuery(), RETURN_TO, failing)).toBeNull();
  });
});

describe('buildSteamLoginUrl', () => {
  it('arma la URL de OpenID con return_to y realm', () => {
    const url = new URL(buildSteamLoginUrl(RETURN_TO, 'http://localhost:5173'));
    expect(url.searchParams.get('openid.mode')).toBe('checkid_setup');
    expect(url.searchParams.get('openid.return_to')).toBe(RETURN_TO);
    expect(url.searchParams.get('openid.realm')).toBe('http://localhost:5173');
  });
});
