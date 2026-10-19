import { describe, expect, it } from 'vitest';
import { getCharacter, getItem, getTrinket } from './catalog-data';
import { STARTING_KITS, startingKit } from './startingItems';

/**
 * Lo que `players.xml` del juego dice (atributos `items` y `pocketActive`), extraído con el
 * ResourceExtractor. Es la fuente de verdad: todo esto tiene que estar en la tabla.
 */
const GAME_DATA: Record<number, number[]> = {
  1: [45],
  3: [34],
  4: [36],
  10: [609],
  13: [357],
  15: [477],
  22: [45],
  23: [710],
  24: [705],
  25: [715],
  26: [713],
  29: [711],
  34: [706],
  36: [712],
  37: [722],
};

/** Nombres esperados: si el catálogo cambia de IDs, este test avisa en vez de mostrar otro ítem. */
const EXPECTED_NAMES: Record<number, string> = {
  105: 'The D6',
  45: 'Yum Heart',
  46: 'Lucky Foot',
  34: 'The Book of Belial',
  36: 'The Poop',
  122: 'Whore of Babylon',
  117: 'Dead Bird',
  126: 'Razor Blade',
  157: 'Bloody Lust',
  214: 'Anemic',
  609: 'Eternal D6',
  313: 'Holy Mantle',
  357: 'Box of Friends',
  360: 'Incubus',
  412: 'Cambion Conception',
  349: 'Wooden Nickel',
  477: 'Void',
  584: 'Book of Virtues',
  710: 'Bag of Crafting',
  705: 'Dark Arts',
  715: 'Hold',
  713: 'Sumptorium',
  711: 'Flip',
  706: 'Abyss',
  712: 'Lemegeton',
  722: 'Anima Sola',
};

describe('STARTING_KITS', () => {
  it('solo referencia personajes, ítems y trinkets que existen en el catálogo', () => {
    for (const [characterId, kit] of Object.entries(STARTING_KITS)) {
      expect(getCharacter(Number(characterId)), `personaje ${characterId}`).toBeDefined();
      for (const e of kit.items) expect(getItem(e.id), `ítem ${e.id}`).toBeDefined();
      for (const e of kit.trinkets) expect(getTrinket(e.id), `trinket ${e.id}`).toBeDefined();
    }
  });

  it('cada ítem es el que dice ser (guarda contra cambios de IDs)', () => {
    for (const [id, name] of Object.entries(EXPECTED_NAMES)) {
      expect(getItem(Number(id))?.name.en).toBe(name);
    }
    const everyItem = Object.values(STARTING_KITS).flatMap((k) => k.items.map((e) => e.id));
    for (const id of everyItem)
      expect(EXPECTED_NAMES[id], `ítem ${id} sin nombre esperado`).toBeDefined();
  });

  it('incluye todo lo que confirma players.xml del juego, y sin pedir desbloqueos', () => {
    for (const [characterId, ids] of Object.entries(GAME_DATA)) {
      const kit = STARTING_KITS[Number(characterId)];
      for (const id of ids) {
        const entry = kit?.items.find((e) => e.id === id);
        expect(entry, `personaje ${characterId} debería tener ${id}`).toBeDefined();
        expect(entry?.requiresUnlock, `lo del XML no depende de desbloqueos (${id})`).toBeFalsy();
      }
    }
  });
});

describe('startingKit', () => {
  it('con todo desbloqueado, Isaac empieza con el D6', () => {
    expect(startingKit(0, true).items).toEqual([105]);
  });

  it('sin saber los desbloqueos, el D6 de Isaac no se asume', () => {
    expect(startingKit(0, false).items).toEqual([]);
  });

  it('lo que no depende de desbloqueos está siempre', () => {
    expect(startingKit(1, false).items).toEqual([45]);
    expect(startingKit(13, false).items).toEqual([357, 360, 412]);
  });

  it('filtra ítems y trinkets según los desbloqueos', () => {
    expect(startingKit(5, true).items).toEqual([122, 117, 126]);
    expect(startingKit(5, false).items).toEqual([122, 117]);
    expect(startingKit(2, true)).toEqual({ items: [46], trinkets: [19] });
    expect(startingKit(2, false)).toEqual({ items: [46], trinkets: [] });
  });

  it('personajes sin ítems iniciales (Eden, Azazel, T. Isaac…) devuelven vacío', () => {
    for (const id of [7, 9, 16, 19, 21, 30, 999]) {
      expect(startingKit(id, true)).toEqual({ items: [], trinkets: [] });
    }
  });
});
