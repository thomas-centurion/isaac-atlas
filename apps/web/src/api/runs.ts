import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  runResponseSchema,
  runsResponseSchema,
  type Run,
  type RunDraftInput,
} from '@isaac-atlas/shared';
import { api } from './client';

const keys = {
  mine: ['runs', 'mine'] as const,
  one: (id: string) => ['runs', id] as const,
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

export function useCreateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RunDraftInput): Promise<Run> =>
      runResponseSchema.parse(await api('/runs', { method: 'POST', body: input })).run,
    onSuccess: (run) => {
      qc.setQueryData(keys.one(run.id), run);
      void qc.invalidateQueries({ queryKey: keys.mine });
    },
  });
}

export function useDeleteRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/runs/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: keys.one(id) });
      void qc.invalidateQueries({ queryKey: keys.mine });
    },
  });
}
