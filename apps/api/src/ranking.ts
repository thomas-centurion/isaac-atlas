/**
 * Límite inferior del intervalo de confianza de Wilson (95 %) para la proporción de votos
 * positivos. Una run con 3 votos a favor no le gana a una con 300 a favor y 20 en contra,
 * que es lo que pasaría ordenando por porcentaje o por diferencia simple.
 */
export function wilsonLowerBound(up: number, down: number, z = 1.96): number {
  const n = up + down;
  if (n <= 0) return 0;
  const p = up / n;
  const z2 = z * z;
  const score = (p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / (1 + z2 / n);
  return round(score);
}

// Referencia fija para que el componente temporal sea chico y estable.
const HOT_EPOCH_SECONDS = Date.UTC(2026, 0, 1) / 1000;
// 45000 s = 12,5 h: multiplicar por 10 el saldo de votos equivale a ser 12,5 h más nueva.
const HOT_DECAY_SECONDS = 45000;

/**
 * Puntaje "hot" al estilo Reddit: log del saldo de votos + antigüedad de la run.
 * El tiempo es el de creación (no "ahora"), así que el puntaje solo cambia al votar y no
 * hace falta ningún job periódico. `+ 1` dentro del log hace que un solo voto ya pese
 * (en una comunidad chica no queremos que el primer voto no valga nada).
 */
export function hotScore(up: number, down: number, createdAt: Date): number {
  const net = up - down;
  const sign = net > 0 ? 1 : net < 0 ? -1 : 0;
  const order = Math.log10(Math.abs(net) + 1);
  const seconds = createdAt.getTime() / 1000 - HOT_EPOCH_SECONDS;
  return round(sign * order + seconds / HOT_DECAY_SECONDS);
}

const round = (n: number) => Math.round(n * 1e7) / 1e7;
