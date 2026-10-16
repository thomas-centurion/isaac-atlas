import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resolveProviderLogin, unlinkIdentity } from '../auth/accounts.js';
import { User } from '../models/User.js';
import { connectTestDb, disconnectTestDb, resetTestDb } from '../test-utils.js';

const google = (id: string, email?: string, verified = true) => ({
  provider: 'google' as const,
  providerId: id,
  emailVerified: verified,
  ...(email ? { email } : {}),
});
const steam = (id: string) => ({
  provider: 'steam' as const,
  providerId: id,
  emailVerified: false,
});

beforeAll(async () => {
  await connectTestDb();
});
afterAll(disconnectTestDb);
beforeEach(resetTestDb);

describe('resolveProviderLogin', () => {
  it('crea una cuenta nueva sin username', async () => {
    const { user, created } = await resolveProviderLogin(google('g1', 'a@example.com'));
    expect(created).toBe(true);
    expect(user.username).toBeUndefined();
    expect(user.email).toBe('a@example.com');
    expect(user.emailVerified).toBe(true);
  });

  it('un segundo login con la misma identidad devuelve la misma cuenta', async () => {
    const first = await resolveProviderLogin(steam('76561198000000001'));
    const second = await resolveProviderLogin(steam('76561198000000001'));
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(await User.countDocuments()).toBe(1);
  });

  it('vincula por email verificado a una cuenta existente', async () => {
    const local = await User.create({
      email: 'a@example.com',
      emailVerified: true,
      username: 'Local',
      usernameLower: 'local',
      passwordHash: 'hash',
    });
    const { user, created } = await resolveProviderLogin(google('g1', 'a@example.com'));
    expect(created).toBe(false);
    expect(user.id).toBe(local.id);
    expect(user.identities.map((i) => i.provider)).toEqual(['google']);
    expect(user.passwordHash).toBe('hash');
  });

  it('NO vincula si el proveedor no verificó el email', async () => {
    await User.create({ email: 'a@example.com', emailVerified: true, passwordHash: 'hash' });
    const { user, created } = await resolveProviderLogin(google('g1', 'a@example.com', false));
    expect(created).toBe(true);
    expect(user.email).toBeUndefined();
    expect(await User.countDocuments()).toBe(2);
  });

  it('anti pre-hijacking: si la cuenta local no había verificado el email, se le quita la clave', async () => {
    await User.create({
      email: 'victim@example.com',
      emailVerified: false,
      passwordHash: 'attacker-known-password-hash',
    });
    const { user } = await resolveProviderLogin(google('g-victim', 'victim@example.com'));
    expect(user.emailVerified).toBe(true);
    expect(user.passwordHash).toBeUndefined();
    const stored = await User.findById(user._id);
    expect(stored?.passwordHash).toBeUndefined();
  });

  it('vincular agrega la identidad a la cuenta actual', async () => {
    const me = await User.create({
      email: 'me@example.com',
      emailVerified: true,
      passwordHash: 'h',
    });
    const { user } = await resolveProviderLogin(steam('76561198000000002'), me._id);
    expect(user.id).toBe(me.id);
    expect(user.identities).toHaveLength(1);
  });

  it('no deja vincular una identidad que ya pertenece a otra cuenta', async () => {
    await resolveProviderLogin(steam('76561198000000003'));
    const me = await User.create({
      email: 'me@example.com',
      emailVerified: true,
      passwordHash: 'h',
    });
    await expect(resolveProviderLogin(steam('76561198000000003'), me._id)).rejects.toMatchObject({
      code: 'identity_in_use',
    });
  });
});

describe('unlinkIdentity', () => {
  it('desvincula si queda otra forma de entrar', async () => {
    const { user } = await resolveProviderLogin(google('g1', 'a@example.com'));
    user.passwordHash = 'hash';
    await user.save();
    const updated = await unlinkIdentity(user, 'google');
    expect(updated.identities).toHaveLength(0);
  });

  it('no deja desvincular el último método de acceso', async () => {
    const { user } = await resolveProviderLogin(steam('76561198000000004'));
    await expect(unlinkIdentity(user, 'steam')).rejects.toMatchObject({
      code: 'last_login_method',
    });
  });

  it('error si la identidad no estaba vinculada', async () => {
    const { user } = await resolveProviderLogin(steam('76561198000000005'));
    await expect(unlinkIdentity(user, 'google')).rejects.toMatchObject({ code: 'not_found' });
  });
});
