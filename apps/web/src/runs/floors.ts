import type { TFunction } from 'i18next';

/**
 * Nombre de un piso. `alt` indica la ruta: true = alterna (Aguacero…), false = normal (Sótano…),
 * sin dato = se muestran ambas, que es como quedaron las runs anteriores a este campo.
 */
export function floorName(t: TFunction, floor: number, alt?: boolean): string {
  if (alt === true) return t(`floorsAlt.${floor}`, { defaultValue: t(`floors.${floor}`) });
  if (alt === false) return t(`floorsNormal.${floor}`, { defaultValue: t(`floors.${floor}`) });
  return t(`floors.${floor}`);
}
