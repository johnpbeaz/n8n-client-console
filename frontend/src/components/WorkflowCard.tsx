import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlayIcon } from '@heroicons/react/24/solid';

import type { Workflow } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface WorkflowCardProps {
  workflow: Workflow;
}

type RunState = 'idle' | 'running' | 'success' | 'error';

export const WorkflowCard = ({ workflow }: WorkflowCardProps) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RunState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [messageVariant, setMessageVariant] = useState<'success' | 'error' | null>(null);

  const runsQuery = useQuery({
    queryKey: ['client-workflow-runs', workflow.id],
    queryFn: () => api.client.workflowRuns(workflow.id, token as string),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const runs = runsQuery.data?.runs ?? [];

  const latestRun = runs[0];

  const formatDateTime = (value?: string | null) =>
    value ? new Date(value).toLocaleString(undefined, { hour12: false }) : '—';

  const extractTriggeredAt = (run?: typeof latestRun) => {
    if (!run) return null;
    const payload = run.requestPayload as any;
    const triggeredAt = payload?.metadata?.triggeredAt;
    return typeof triggeredAt === 'string' ? triggeredAt : null;
  };

  const extractErrorMessage = (run?: typeof latestRun) => {
    if (!run || run.status !== 'failed') return null;
    const response = run.responsePayload as any;
    if (response?.message) return String(response.message);
    if (typeof response === 'string') return response;
    return null;
  };

  const triggeredAt = useMemo(() => extractTriggeredAt(latestRun), [latestRun]);
  const completedAt = latestRun?.createdAt ?? null;
  const lastStatus = latestRun?.status ?? null;
  const lastErrorMessage = extractErrorMessage(latestRun);

  const triggerMutation = useMutation({
    mutationFn: () => api.workflows.trigger(workflow.id, token as string, {}),
    onMutate: () => {
      setState('running');
      setMessage(null);
      setMessageVariant(null);
    },
    onSuccess: () => {
      setState('success');
      setMessage('Workflow triggered successfully.');
       setMessageVariant('success');
      queryClient.invalidateQueries({ queryKey: ['client-workflows'] });
      queryClient.invalidateQueries({ queryKey: ['client-workflow-runs', workflow.id] });
    },
    onError: (error) => {
      setState('error');
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage('Workflow trigger failed — check the n8n logs.');
      }
      setMessageVariant('error');
    },
    onSettled: () => {
      setTimeout(() => setState('idle'), 4000);
    },
  });

  const handleRun = () => {
    if (!token) {
      setMessage('You need to sign in again.');
      setState('error');
      return;
    }
    triggerMutation.mutate();
  };

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{workflow.name}</h3>
          {workflow.description ? (
            <p className="mt-1 text-sm text-slate-600">{workflow.description}</p>
          ) : null}
        </div>

        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${(() => {
            if (state === 'running') return 'bg-blue-100 text-blue-700';
            if (state === 'success') return 'bg-emerald-100 text-emerald-700';
            if (state === 'error') return 'bg-rose-100 text-rose-700';
            if (lastStatus === 'failed') return 'bg-rose-100 text-rose-700';
            if (lastStatus === 'success') return 'bg-emerald-100 text-emerald-700';
            return 'bg-slate-100 text-slate-600';
          })()}`}
        >
          {(() => {
            if (state === 'running') return 'Running…';
            if (state === 'success') return 'Success';
            if (state === 'error') return 'Error';
            if (lastStatus === 'failed') return 'Failed';
            if (lastStatus === 'success') return 'Success';
            return 'Idle';
          })()}
        </span>
      </div>

      <div className="mt-4 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <div className="flex items-center justify-between">
          <span className="font-medium">Started</span>
          <span>{formatDateTime(triggeredAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Completed</span>
          <span>{formatDateTime(completedAt)}</span>
        </div>
        {lastErrorMessage ? (
          <div className="rounded border border-rose-200 bg-white p-2 text-rose-600">
            <p className="text-xs font-medium">Error</p>
            <p className="mt-1 text-xs text-rose-600/80">{lastErrorMessage}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleRun}
          disabled={state === 'running' || triggerMutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <PlayIcon className="h-4 w-4" />
          {triggerMutation.isPending ? 'Triggering…' : 'Trigger Workflow'}
        </button>
      </div>

      {state === 'running' ? (
        <div className="mt-4 w-full">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="animate-progress h-full w-1/2 rounded-full bg-slate-500" />
          </div>
          <p className="mt-2 text-xs text-slate-500">Running workflow… this may take a moment.</p>
        </div>
      ) : message ? (
        <p
          className={`mt-4 text-sm ${
            messageVariant === 'error' ? 'text-rose-600' : 'text-emerald-600'
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Recent runs</span>
          <span>{runs.length ? `${runs.length} total` : ''}</span>
        </div>
        {runsQuery.isLoading ? (
          <p className="mt-2 text-xs text-slate-500">Loading run history…</p>
        ) : runs.length ? (
          <ul className="mt-2 space-y-2 text-xs text-slate-600">
            {runs.slice(0, 3).map((run) => {
              const runTriggeredAt = extractTriggeredAt(run);
              const runCompletedAt = run.createdAt;
              const runError = extractErrorMessage(run);
              return (
                <li key={run.id} className="rounded border border-slate-200 bg-white p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{run.status}</span>
                    <span>{formatDateTime(runTriggeredAt)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-slate-500">
                    <span>Completed</span>
                    <span>{formatDateTime(runCompletedAt)}</span>
                  </div>
                  {runError ? (
                    <p className="mt-1 truncate text-rose-600">{runError}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No workflow history yet.</p>
        )}
      </div>
    </article>
  );
};
