import { catalog, type CatalogItem, type CatalogTrinket } from '@isaac-atlas/shared';

export type SearchKind = 'item' | 'trinket';

export interface SearchResult {
  kind: SearchKind;
  id: number;
  entry: CatalogItem | CatalogTrinket;
}

/** Minúsculas, sin tildes ni signos: "Cricket's Head" → "crickets head". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const LEADING_ARTICLE = /^(the|a|an|el|la|los|las|un|una) /;

/** El nombre normalizado y, si lo tiene, sin artículo inicial: "d6" encuentra "The D6" como exacto. */
function nameVariants(name: string): string[] {
  const full = normalize(name);
  const bare = full.replace(LEADING_ARTICLE, '');
  return bare === full || !bare ? [full] : [full, bare];
}

interface IndexEntry {
  result: SearchResult;
  names: string[];
  quality: number;
}

function buildIndex(kind: SearchKind): IndexEntry[] {
  const source: (CatalogItem | CatalogTrinket)[] =
    kind === 'item' ? catalog.items : catalog.trinkets;
  return source.map((entry) => ({
    result: { kind, id: entry.id, entry },
    names: [...new Set([entry.name.en, entry.name.es].flatMap(nameVariants))],
    quality: 'quality' in entry ? entry.quality : 0,
  }));
}

const indexes: Partial<Record<SearchKind, IndexEntry[]>> = {};

function scoreName(name: string, query: string, tokens: string[]): number {
  if (name === query) return 100;
  if (name.startsWith(query)) return 80;
  if (name.split(' ').some((w) => w.startsWith(query))) return 60;
  if (name.includes(query)) return 40;
  // Varias palabras en cualquier orden: "spider mutant" encuentra "Mutant Spider".
  if (tokens.length > 1 && tokens.every((t) => name.includes(t))) return 30;
  return 0;
}

/** Busca por nombre (EN o ES, sin tildes) o por ID numérico. */
export function searchCatalog(rawQuery: string, kind: SearchKind, limit = 8): SearchResult[] {
  const query = normalize(rawQuery);
  if (!query) return [];
  const index = (indexes[kind] ??= buildIndex(kind));
  const tokens = query.split(' ');
  const isId = /^\d+$/.test(query);

  const scored: { entry: IndexEntry; score: number }[] = [];
  for (const entry of index) {
    let score = Math.max(...entry.names.map((n) => scoreName(n, query, tokens)));
    if (isId && String(entry.result.id) === query) score = Math.max(score, 90);
    if (score > 0) scored.push({ entry, score });
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.entry.quality - a.entry.quality ||
        (a.entry.names[0]?.length ?? 0) - (b.entry.names[0]?.length ?? 0),
    )
    .slice(0, limit)
    .map((s) => s.entry.result);
}
