import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  filtersToParams,
  runResponseSchema,
  runSearchResponseSchema,
  runsResponseSchema,
  seedSummarySchema,
  type Run,
  type RunDraftInput,
  type SearchFilters,
} from '@isaac-atlas/shared';
import { api } from './client';

const keys = {
  all: ['runs'] as const,
  mine: ['runs', 'mine'] as const,
  one: (id: string) => ['runs', 'one', id] as const,
  search: (params: string) => ['runs', 'search', params] as const,
  seed: (seed: string) => ['seeds', seed] as const,
};

export function useRun(id: string | undefined) {
  return useQuery({
    queryKey: keys.one(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => runResponseSchema.parse(await api(`/runs/${id}`)).run,
  });
}

export function useMyRuns() {
  return useQuery({
    queryKey: keys.mine,
    queryFn: async () => runsResponseSchema.parse(await api('/runs/mine')).runs,
  });
}

/** Búsqueda con paginación por cursor ("Cargar más"). Cada combinación de filtros se cachea aparte. */
export function useRunSearch(filters: SearchFilters) {
  const params = filtersToParams(filters).toString();
  return useInfiniteQuery({
    queryKey: keys.search(params),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query = new URLSearchParams(params);
      if (pageParam) query.set('cursor', pageParam);
      return runSearchResponseSchema.parse(await api(`/runs?${query.toString()}`));
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useSeedSummary(seed: string | undefined) {
  return useQuery({
    queryKey: keys.seed(seed ?? ''),
    enabled: Boolean(seed),
    queryFn: async () => seedSummarySchema.parse(await api(`/seeds/${encodeURIComponent(seed!)}`)),
  });
}

export function useCreateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RunDraftInput): Promise<Run> =>
      runResponseSchema.parse(await api('/runs', { method: 'POST', body: input })).run,
    onSuccess: (run) => {
      qc.setQueryData(keys.one(run.id), run);
      // Listas y búsquedas quedan desactualizadas (y el resumen de la seed).
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: ['seeds'] });
    },
  });
}

export function useDeleteRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/runs/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: keys.one(id) });
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: ['seeds'] });
    },
  });
}
