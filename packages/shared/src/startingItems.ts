/**
 * Ítems con los que cada personaje empieza una run en Repentance+.
 *
 * Fuentes (cruzadas):
 *  - `players.xml` del juego (atributos `items` / `pocketActive`): fuente de verdad. Lo confirmado
 *    ahí se marca con [XML].
 *  - Infobox de cada personaje en la wiki (bindingofisaacrebirth.wiki.gg), para lo que el juego
 *    resuelve en código y no está en el XML. Se marca con [wiki].
 *
 * `requiresUnlock`: el ítem solo se tiene si el jugador desbloqueó el logro correspondiente
 * (p. ej. el D6 de Isaac exige derrotar a Isaac como ???). Por eso el autocompletado respeta la casilla
 * "save con todo desbloqueado" de cada run.
 *
 * Quedaron afuera, a propósito: efectos innatos que no son un ítem que se tenga en el inventario
 * (el Brimstone de corto alcance de Azazel, el triple tiro de Keeper, Lil Larva innato de ???),
 * cartas (La Santa Carta de T. Lost, El Loco de Azazel) y los ítems aleatorios de Eden.
 */

export interface StartingEntry {
  id: number;
  requiresUnlock?: boolean;
}

export interface StartingKit {
  items: StartingEntry[];
  trinkets: StartingEntry[];
}

const kit = (items: StartingEntry[], trinkets: StartingEntry[] = []): StartingKit => ({
  items,
  trinkets,
});

/** Por ID de jugador (el mismo `characterId` de las runs). Personajes ausentes: sin ítems iniciales. */
export const STARTING_KITS: Readonly<Record<number, StartingKit>> = {
  // --- Personajes normales ---
  0: kit([{ id: 105, requiresUnlock: true }]), // Isaac: The D6 [wiki]
  1: kit([{ id: 45 }]), // Magdalene: Yum Heart [XML]
  2: kit([{ id: 46 }], [{ id: 19, requiresUnlock: true }]), // Cain: Lucky Foot [wiki]; Paper Clip [wiki]
  3: kit([{ id: 34 }]), // Judas: The Book of Belial [XML]
  4: kit([{ id: 36 }]), // ???: The Poop [XML]
  5: kit([{ id: 122 }, { id: 117 }, { id: 126, requiresUnlock: true }]), // Eve: Whore of Babylon, Dead Bird, Razor Blade [wiki]
  6: kit([{ id: 157 }], [{ id: 34, requiresUnlock: true }]), // Samson: Bloody Lust [wiki]; Child's Heart [wiki]
  8: kit([{ id: 214, requiresUnlock: true }]), // Lazarus: Anemic [wiki]
  10: kit([{ id: 609 }, { id: 313, requiresUnlock: true }]), // The Lost: Eternal D6 [XML]; Holy Mantle [wiki]
  13: kit([{ id: 357 }, { id: 360 }, { id: 412 }]), // Lilith: Box of Friends [XML]; Incubus, Cambion Conception [wiki]
  14: kit([{ id: 349, requiresUnlock: true }], [{ id: 83, requiresUnlock: true }]), // Keeper: Wooden Nickel; Store Key [wiki]
  15: kit([{ id: 477 }]), // Apollyon: Void [XML]
  18: kit([{ id: 584 }]), // Bethany: Book of Virtues [wiki]

  // --- Tainted: su activo de bolsillo viene en el XML (`pocketActive`) ---
  22: kit([{ id: 45 }]), // T. Magdalene: Yum Heart [XML]
  23: kit([{ id: 710 }]), // T. Cain: Bag of Crafting [XML]
  24: kit([{ id: 705 }]), // T. Judas: Dark Arts [XML]
  25: kit([{ id: 715 }]), // T. ???: Hold [XML]
  26: kit([{ id: 713 }]), // T. Eve: Sumptorium [XML]
  29: kit([{ id: 711 }]), // T. Lazarus: Flip [XML]
  34: kit([{ id: 706 }]), // T. Apollyon: Abyss [XML]
  36: kit([{ id: 712 }]), // T. Bethany: Lemegeton [XML]
  37: kit([{ id: 722 }]), // T. Jacob: Anima Sola [XML]
};

export interface ResolvedKit {
  items: number[];
  trinkets: number[];
}

/**
 * Ítems y trinkets iniciales de un personaje. Con `fullUnlocks: false` quedan solo los que no
 * dependen de ningún desbloqueo (no sabemos cuáles tiene el jugador).
 */
export function startingKit(characterId: number, fullUnlocks: boolean): ResolvedKit {
  const entry = STARTING_KITS[characterId];
  const keep = (e: StartingEntry) => fullUnlocks || !e.requiresUnlock;
  return {
    items: entry?.items.filter(keep).map((e) => e.id) ?? [],
    trinkets: entry?.trinkets.filter(keep).map((e) => e.id) ?? [],
  };
}
