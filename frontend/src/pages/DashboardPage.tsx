import { useQuery } from '@tanstack/react-query';

import { AppShell } from '../components/AppShell';
import { WorkflowCard } from '../components/WorkflowCard';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export const DashboardPage = () => {
  const { user, token } = useAuth();

  if (!user) {
    return null;
  }

  if (user.role === 'admin') {
    return (
      <AppShell>
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back, {user.name}</h1>
          <p className="mt-2 text-sm text-slate-600">
            You&apos;re signed in as an administrator. Use the Admin tab to manage client-workflow assignments or
            impersonate a client account to preview the end-user experience.
          </p>
        </div>
      </AppShell>
    );
  }

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['client-workflows'],
    queryFn: () => api.client.workflows(token as string),
    enabled: Boolean(token),
  });

  const workflows = data?.workflows ?? [];
  const clientName = user.clientName ?? 'Client Dashboard';

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Client</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">{clientName}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Trigger your n8n workflows on demand and review their latest execution time. These entries are pulled live
              from your assigned workspace in n8n.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </header>

        {isError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            <p className="font-semibold">Unable to fetch workflows.</p>
            <p className="mt-2 text-xs opacity-80">
              {error instanceof Error ? error.message : 'Check the backend container logs for more information.'}
            </p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="text-sm text-slate-500">Loading workflows…</p>
          </div>
        ) : workflows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-lg font-semibold text-slate-700">No workflows assigned yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Once your solutions team assigns workflows to your account, they will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {workflows.map((workflow) => (
              <WorkflowCard key={workflow.id} workflow={workflow} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

