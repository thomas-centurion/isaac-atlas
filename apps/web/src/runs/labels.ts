import type { TFunction } from 'i18next';
import type { CatalogCharacter, Locale } from '@isaac-atlas/shared';

/** "Isaac" / "T. Isaac": las variantes Tainted se distinguen con prefijo. */
export function characterLabel(character: CatalogCharacter, lang: Locale, t: TFunction): string {
  const name = character.name[lang];
  return character.tainted ? `${t('run.taintedPrefix')} ${name}` : name;
}
