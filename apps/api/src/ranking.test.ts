import { describe, expect, it } from 'vitest';
import { hotScore, wilsonLowerBound } from './ranking.js';

describe('wilsonLowerBound', () => {
  it('es 0 sin votos', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it('una run con pocos votos perfectos no le gana a una con muchos votos y algunos en contra', () => {
    expect(wilsonLowerBound(300, 20)).toBeGreaterThan(wilsonLowerBound(3, 0));
  });

  it('más votos positivos con la misma proporción dan más confianza', () => {
    expect(wilsonLowerBound(100, 0)).toBeGreaterThan(wilsonLowerBound(10, 0));
  });

  it('queda entre 0 y 1 y baja con los votos negativos', () => {
    const score = wilsonLowerBound(10, 0);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
    expect(wilsonLowerBound(10, 10)).toBeLessThan(score);
  });
});

describe('hotScore', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  const hoursLater = (h: number) => new Date(now.getTime() + h * 3600_000);

  it('una run más nueva sin votos supera a una más vieja sin votos', () => {
    expect(hotScore(0, 0, hoursLater(1))).toBeGreaterThan(hotScore(0, 0, now));
  });

  it('un voto a favor sube la run y un voto en contra la baja', () => {
    expect(hotScore(1, 0, now)).toBeGreaterThan(hotScore(0, 0, now));
    expect(hotScore(0, 1, now)).toBeLessThan(hotScore(0, 0, now));
  });

  it('las votaciones compensan la antigüedad: 9 votos netos ≈ 12,5 horas', () => {
    const older = hotScore(9, 0, now);
    const newer = hotScore(0, 0, hoursLater(12));
    expect(older).toBeGreaterThan(newer);
    expect(hotScore(9, 0, now)).toBeLessThan(hotScore(0, 0, hoursLater(13)));
  });

  it('depende solo del saldo de votos, no de cuántos hay a favor y en contra', () => {
    expect(hotScore(12, 10, now)).toBeCloseTo(hotScore(3, 1, now), 6);
  });
});
