import argon2 from 'argon2';

// argon2id con los parámetros por defecto de la librería (OWASP-compatibles).
const options = { type: argon2.argon2id } as const;

export const hashPassword = (plain: string) => argon2.hash(plain, options);

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Verifica contra un hash falso para que "email inexistente" tarde lo mismo que "clave mala". */
export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(await dummyHash, plain);
}
