import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  dailyResponseSchema,
  filtersToParams,
  profileSchema,
  reportsResponseSchema,
  runResponseSchema,
  runSearchResponseSchema,
  runsResponseSchema,
  seedSummarySchema,
  type ReportInput,
  type ResolveAction,
  type Run,
  type RunDraftInput,
  type SearchFilters,
  type VerdictKind,
} from '@isaac-atlas/shared';
import { mapRunInCache, withVerdict, withVote, type VoteChoice } from '../runs/reactions';
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

export function useDaily() {
  return useQuery({
    queryKey: ['daily'] as const,
    queryFn: async () => dailyResponseSchema.parse(await api('/daily')),
    // La seed del día no cambia durante el día.
    staleTime: 10 * 60_000,
  });
}

/** Cachés que pueden contener una misma run (lista, búsqueda, detalle, seed, seed del día). */
const RUN_CACHES = [['runs'], ['seeds'], ['daily']] as const;

type Snapshot = [readonly unknown[], unknown][];

function snapshotRunCaches(qc: QueryClient): Snapshot {
  return RUN_CACHES.flatMap((key) =>
    qc
      .getQueriesData({ queryKey: key })
      .map(([k, data]) => [k, data] as [readonly unknown[], unknown]),
  );
}

function patchRunCaches(qc: QueryClient, runId: string, fn: (run: Run) => Run) {
  for (const key of RUN_CACHES) {
    qc.setQueriesData({ queryKey: key }, (data: unknown) =>
      data === undefined ? data : mapRunInCache(data, runId, fn),
    );
  }
}

/**
 * Mutación "optimista" sobre una run: la interfaz cambia al instante, si el servidor falla se
 * vuelve atrás, y al terminar se reemplaza por lo que respondió el servidor (sin recargar listas:
 * la run no salta de lugar mientras se está mirando).
 */
function useRunReaction<V extends { runId: string }>(
  request: (vars: V) => Promise<unknown>,
  optimistic: (vars: V) => (run: Run) => Run,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: V) => runResponseSchema.parse(await request(vars)).run,
    onMutate: (vars) => {
      const snapshot = snapshotRunCaches(qc);
      patchRunCaches(qc, vars.runId, optimistic(vars));
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      for (const [key, data] of context?.snapshot ?? []) qc.setQueryData(key, data);
    },
    onSuccess: (run) => patchRunCaches(qc, run.id, () => run),
  });
}

export const useVote = () =>
  useRunReaction<{ runId: string; value: VoteChoice }>(
    ({ runId, value }) =>
      value === 0
        ? api(`/runs/${runId}/vote`, { method: 'DELETE' })
        : api(`/runs/${runId}/vote`, { method: 'PUT', body: { value } }),
    ({ value }) =>
      (run) =>
        withVote(run, value),
  );

export const useVerdict = () =>
  useRunReaction<{ runId: string; kind: VerdictKind | null }>(
    ({ runId, kind }) =>
      kind === null
        ? api(`/runs/${runId}/verdict`, { method: 'DELETE' })
        : api(`/runs/${runId}/verdict`, { method: 'PUT', body: { kind } }),
    ({ kind }) =>
      (run) =>
        withVerdict(run, kind),
  );

export function useUpdateRun(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RunDraftInput): Promise<Run> =>
      runResponseSchema.parse(await api(`/runs/${id}`, { method: 'PUT', body: input })).run,
    onSuccess: (run) => {
      qc.setQueryData(keys.one(run.id), run);
      // La run puede haber cambiado de seed, personaje o ítems: listas, búsquedas y seeds quedan viejas.
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: ['seeds'] });
      void qc.invalidateQueries({ queryKey: ['daily'] });
    },
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

export function useProfile(username: string | undefined) {
  return useQuery({
    queryKey: ['users', username ?? ''] as const,
    enabled: Boolean(username),
    queryFn: async () => profileSchema.parse(await api(`/users/${encodeURIComponent(username!)}`)),
  });
}

export function useReportRun() {
  return useMutation({
    mutationFn: ({ runId, ...input }: { runId: string } & ReportInput) =>
      api(`/runs/${runId}/report`, { method: 'POST', body: input }),
  });
}

export function useAdminReports(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'reports'] as const,
    enabled,
    queryFn: async () => reportsResponseSchema.parse(await api('/admin/reports')).reports,
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, action }: { reportId: string; action: ResolveAction }) =>
      api(`/admin/reports/${reportId}/resolve`, { method: 'POST', body: { action } }),
    onSuccess: () => {
      // Resolver puede devolver una run a las listas o borrarla.
      void qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      void qc.invalidateQueries({ queryKey: ['runs'] });
      void qc.invalidateQueries({ queryKey: ['seeds'] });
      void qc.invalidateQueries({ queryKey: ['daily'] });
    },
  });
}
