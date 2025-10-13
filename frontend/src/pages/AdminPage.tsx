import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { Client, Invitation, N8nWorkflowOption } from '../types';
import {
  ArchiveBoxArrowDownIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  KeyIcon,
  TrashIcon,
} from '@heroicons/react/24/solid';

export const AdminPage = () => {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientMessage, setClientMessage] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientDescription, setNewClientDescription] = useState('');
  const [newClientEmails, setNewClientEmails] = useState<string[]>(['']);
  const [newClientWorkflowIds, setNewClientWorkflowIds] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [clientEmailDrafts, setClientEmailDrafts] = useState<{ id?: string; value: string }[]>([]);
  const [emailUpdateError, setEmailUpdateError] = useState<string | null>(null);
  const [selectedClientWorkflowIds, setSelectedClientWorkflowIds] = useState<string[]>([]);
  const [n8nBaseUrl, setN8nBaseUrl] = useState('');
  const [n8nApiKeyInput, setN8nApiKeyInput] = useState('');
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const [clearApiKey, setClearApiKey] = useState(false);

  if (!user || user.role !== 'admin') {
    return null;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const describeInvitations = (invitations?: Invitation[]) => {
    if (!invitations || invitations.length === 0) {
      return null;
    }

    const details = invitations
      .map((invitation) =>
        invitation.emailed
          ? `${invitation.email} (email sent)`
          : `${invitation.email} (share link: ${invitation.setupUrl ?? 'unavailable'})`,
      )
      .join('; ');

    return `Password setup ${invitations.length === 1 ? 'link' : 'links'}: ${details}`;
  };

  const describeLoginList = (clientRecord: Client) => {
    if (!clientRecord.emails.length) {
      return 'No login emails yet';
    }

    if (clientRecord.emails.length === 1) {
      return `Login: ${clientRecord.emails[0].email}`;
    }

    return `Login: ${clientRecord.emails[0].email} (+${clientRecord.emails.length - 1} more)`;
  };

  const clientsQuery = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => api.admin.clients(token as string, { includeArchived: true }),
    enabled: Boolean(token),
  });

  const n8nConfigQuery = useQuery({
    queryKey: ['admin-n8n-config'],
    queryFn: () => api.admin.getN8nConfig(token as string),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  });

  const availableWorkflowsQuery = useQuery({
    queryKey: ['admin-n8n-workflows'],
    queryFn: () => api.admin.n8nWorkflows(token as string),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  });

  const activeClients = useMemo(
    () => (clientsQuery.data?.clients ?? []).filter((client) => !client.archivedAt),
    [clientsQuery.data?.clients],
  );

  const archivedClients = useMemo(
    () => (clientsQuery.data?.clients ?? []).filter((client) => Boolean(client.archivedAt)),
    [clientsQuery.data?.clients],
  );

  useEffect(() => {
    if (!selectedClientId) {
      if (activeClients.length) {
        setSelectedClientId(activeClients[0].id);
      } else if (archivedClients.length) {
        setSelectedClientId(archivedClients[0].id);
      }
      return;
    }

    const stillExists =
      activeClients.some((client) => client.id === selectedClientId) ||
      archivedClients.some((client) => client.id === selectedClientId);

    if (!stillExists) {
      if (activeClients.length) {
        setSelectedClientId(activeClients[0].id);
      } else if (archivedClients.length) {
        setSelectedClientId(archivedClients[0].id);
      } else {
        setSelectedClientId('');
      }
    }
  }, [activeClients, archivedClients, selectedClientId]);

  useEffect(() => {
    if (n8nConfigQuery.data) {
      setN8nBaseUrl(n8nConfigQuery.data.baseUrl ?? '');
      setHasStoredApiKey(n8nConfigQuery.data.hasApiKey);
      setN8nApiKeyInput('');
      setClearApiKey(false);
    }
  }, [n8nConfigQuery.data]);

  const workflowsQuery = useQuery({
    queryKey: ['admin-client-workflows', selectedClientId],
    queryFn: () => api.admin.clientWorkflows(selectedClientId, token as string),
    enabled: Boolean(token && selectedClientId),
  });

  useEffect(() => {
    if (workflowsQuery.data?.workflows) {
      setSelectedClientWorkflowIds(
        workflowsQuery.data.workflows.map((workflow) => workflow.n8nWorkflowId),
      );
    } else {
      setSelectedClientWorkflowIds([]);
    }
  }, [workflowsQuery.data?.workflows, selectedClientId]);

  const createClientMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      emails: string[];
      workflowIds?: string[];
    }) => api.admin.createClient(payload, token as string),
    onMutate: () => {
      setCreateError(null);
      setClientMessage(null);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      setSelectedClientId(result.client.id);
      setIsCreateOpen(false);
      setNewClientName('');
      setNewClientDescription('');
      setNewClientEmails(['']);
      setNewClientWorkflowIds([]);

      const summary = describeInvitations(result.invitations);
      setClientMessage(
        summary
          ? `Created client "${result.client.name}". ${summary}`
          : `Created client "${result.client.name}".`,
      );
    },
    onError: (error) => {
      setCreateError(error instanceof Error ? error.message : 'Failed to create client.');
      setClientMessage(null);
    },
  });

  const updateN8nConfigMutation = useMutation({
    mutationFn: (payload: { baseUrl: string; webhookBaseUrl?: string | null; apiKey?: string | null }) =>
      api.admin.updateN8nConfig(payload, token as string),
    onMutate: () => {
      setSettingsError(null);
      setSettingsMessage(null);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['admin-n8n-config'], result);
      setSettingsMessage('n8n connection settings updated.');
      setN8nBaseUrl(result.baseUrl ?? '');
      setHasStoredApiKey(result.hasApiKey);
      setN8nApiKeyInput('');
      setClearApiKey(false);
    },
    onError: (error) => {
      setSettingsError(
        error instanceof Error ? error.message : 'Failed to update n8n settings. Try again shortly.',
      );
      setSettingsMessage(null);
    },
  });

  const handleCreateClient = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = newClientName.trim();
    if (!trimmedName) {
      setCreateError('Client name is required.');
      return;
    }

    const normalisedEmails = newClientEmails
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0);

    if (!normalisedEmails.length) {
      setCreateError('Add at least one client email address.');
      return;
    }

    const invalidEmail = normalisedEmails.find((value) => !emailPattern.test(value));
    if (invalidEmail) {
      setCreateError(`Enter a valid email address: ${invalidEmail}`);
      return;
    }

    const uniqueEmails = Array.from(new Set(normalisedEmails));
    if (uniqueEmails.length !== normalisedEmails.length) {
      setCreateError('Email addresses must be unique.');
      return;
    }

    if (!newClientWorkflowIds.length) {
      setCreateError('Select at least one workflow.');
      return;
    }

    createClientMutation.mutate({
      name: trimmedName,
      description: newClientDescription.trim() ? newClientDescription.trim() : undefined,
      emails: uniqueEmails,
      workflowIds: newClientWorkflowIds,
    });
  };

  const toggleNewClientWorkflow = (workflowId: string) => {
    setNewClientWorkflowIds((previous) =>
      previous.includes(workflowId)
        ? previous.filter((id) => id !== workflowId)
        : [...previous, workflowId],
    );
  };

  const toggleSelectedClientWorkflow = (workflowId: string) => {
    setSelectedClientWorkflowIds((previous) =>
      previous.includes(workflowId)
        ? previous.filter((id) => id !== workflowId)
        : [...previous, workflowId],
    );
  };

  const selectedClient = useMemo(
    () => clientsQuery.data?.clients.find((client) => client.id === selectedClientId),
    [clientsQuery.data?.clients, selectedClientId],
  );

  useEffect(() => {
    if (selectedClient) {
      const drafts =
        selectedClient.emails.length > 0
          ? selectedClient.emails.map((email) => ({
              id: email.id,
              value: email.email,
            }))
          : [{ value: '' }];
      setClientEmailDrafts(drafts);
    } else {
      setClientEmailDrafts([]);
    }
    setEmailUpdateError(null);
  }, [selectedClient]);

  const originalClientWorkflowIds = useMemo(
    () => workflowsQuery.data?.workflows?.map((workflow) => workflow.n8nWorkflowId) ?? [],
    [workflowsQuery.data?.workflows],
  );

  const clientEmailsDirty = useMemo(() => {
    if (!selectedClient) {
      return false;
    }

    const normalise = (record: { id?: string | null; email: string }) => ({
      id: record.id ?? '',
      email: record.email.trim().toLowerCase(),
    });

    const draftNormalized = clientEmailDrafts
      .filter((draft) => draft.value.trim().length > 0)
      .map((draft) => normalise({ id: draft.id, email: draft.value }));

    const originalNormalized = selectedClient.emails.map((email) =>
      normalise({ id: email.id, email: email.email }),
    );

    if (draftNormalized.length !== originalNormalized.length) {
      return true;
    }

    const sortFn = (a: { id: string; email: string }, b: { id: string; email: string }) => {
      const aKey = a.id || a.email;
      const bKey = b.id || b.email;
      return aKey.localeCompare(bKey);
    };

    const sortedDrafts = [...draftNormalized].sort(sortFn);
    const sortedOriginal = [...originalNormalized].sort(sortFn);

    return sortedDrafts.some((draft, index) => draft.email !== sortedOriginal[index].email);
  }, [clientEmailDrafts, selectedClient]);

  const workflowSelectionDirty = useMemo(() => {
    const current = [...selectedClientWorkflowIds].sort();
    const original = [...originalClientWorkflowIds].sort();
    return current.length !== original.length || current.some((value, index) => value !== original[index]);
  }, [originalClientWorkflowIds, selectedClientWorkflowIds]);

  const workflowOptions = useMemo(() => {
    const map = new Map<string, N8nWorkflowOption>();

    (availableWorkflowsQuery.data?.workflows ?? []).forEach((workflow) => {
      map.set(workflow.id, workflow);
    });

    (workflowsQuery.data?.workflows ?? []).forEach((workflow) => {
      if (!map.has(workflow.n8nWorkflowId)) {
        map.set(workflow.n8nWorkflowId, {
          id: workflow.n8nWorkflowId,
          name: workflow.name,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableWorkflowsQuery.data?.workflows, workflowsQuery.data?.workflows]);

  const archiveMutation = useMutation({
    mutationFn: () => api.admin.archiveClient(selectedClientId, token as string),
    onMutate: () => {
      setClientMessage(null);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      setClientMessage(`Archived client "${result.client.name}".`);
    },
    onError: (error) => {
      setClientMessage(
        error instanceof Error ? error.message : 'Failed to archive client. Try again shortly.',
      );
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: () => api.admin.unarchiveClient(selectedClientId, token as string),
    onMutate: () => {
      setClientMessage(null);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      setClientMessage(`Restored client "${result.client.name}".`);
    },
    onError: (error) => {
      setClientMessage(
        error instanceof Error ? error.message : 'Failed to restore client. Try again shortly.',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.admin.deleteClient(selectedClientId, token as string),
    onMutate: () => {
      setClientMessage(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin-client-workflows'] });
      setClientMessage('Client deleted.');
      setSelectedClientId('');
    },
    onError: (error) => {
      setClientMessage(
        error instanceof Error ? error.message : 'Failed to delete client. Try again shortly.',
      );
    },
  });

  const updateClientWorkflowsMutation = useMutation({
    mutationFn: (workflowIds: string[]) =>
      api.admin.updateClientWorkflows(selectedClientId, workflowIds, token as string),
    onMutate: () => {
      setClientMessage(null);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-client-workflows', selectedClientId] });
      const clientName = selectedClient?.name ?? 'client';
      setClientMessage(`Workflow access updated for ${clientName}.`);
      setSelectedClientWorkflowIds(result.workflows.map((workflow) => workflow.n8nWorkflowId));
    },
    onError: (error) => {
      setClientMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update workflows. Please try again shortly.',
      );
    },
  });

  const syncClientWorkflowsMutation = useMutation({
    mutationFn: () => api.admin.syncClientWorkflows(selectedClientId, token as string),
    onMutate: () => {
      setClientMessage(null);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-client-workflows', selectedClientId] });
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin-n8n-workflows'] });
      setSelectedClientWorkflowIds(result.workflows.map((workflow) => workflow.n8nWorkflowId));
      setClientMessage(
        result.synced
          ? `Synced ${result.synced} workflow${result.synced === 1 ? '' : 's'} from n8n.`
          : 'Nothing new to sync from n8n.',
      );
    },
    onError: (error) => {
      setClientMessage(
        error instanceof Error ? error.message : 'Failed to sync workflows from n8n. Try again shortly.',
      );
    },
  });

  const updateClientEmailsMutation = useMutation({
    mutationFn: (payload: { emails: { id?: string; email: string }[] }) =>
      api.admin.updateClientEmails(selectedClientId, payload, token as string),
    onMutate: () => {
      setEmailUpdateError(null);
      setClientMessage(null);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      queryClient.setQueryData(
        ['admin-clients'],
        (previous: { clients: Client[] } | undefined) => {
          if (!previous) {
            return previous;
          }
          return {
            clients: previous.clients.map((clientRecord) =>
              clientRecord.id === result.client.id ? result.client : clientRecord,
            ),
          };
        },
      );
      setClientEmailDrafts(
        result.client.emails.map((email) => ({
          id: email.id,
          value: email.email,
        })),
      );
      const summary = describeInvitations(result.invitations);
      setEmailUpdateError(null);
      setClientMessage(
        summary
          ? `Email addresses updated for ${result.client.name}. ${summary}`
          : `Email addresses updated for ${result.client.name}.`,
      );
    },
    onError: (error) => {
      setEmailUpdateError(
        error instanceof Error ? error.message : 'Failed to update client emails. Try again shortly.',
      );
    },
  });

  const resetClientPasswordMutation = useMutation({
    mutationFn: (email: string) => api.admin.resetClientPassword(selectedClientId, email, token as string),
    onMutate: () => {
      setClientMessage(null);
    },
    onSuccess: (result) => {
      const { email, emailed, setupUrl } = result.invitation;
      if (emailed) {
        setClientMessage(`Password reset email sent to ${email}.`);
      } else {
        setClientMessage(
          setupUrl
            ? `Email could not be sent automatically. Share this password setup link with ${email}: ${setupUrl}`
            : `Email could not be sent automatically. Share a new password setup link with ${email}.`,
        );
      }
    },
    onError: (error) => {
      setClientMessage(
        error instanceof Error ? error.message : 'Failed to reset password. Try again shortly.',
      );
    },
  });

  const handleArchive = () => {
    if (!selectedClientId) {
      return;
    }
    archiveMutation.mutate();
  };

  const handleUnarchive = () => {
    if (!selectedClientId) {
      return;
    }
    unarchiveMutation.mutate();
  };

  const handleDelete = () => {
    if (!selectedClientId) {
      return;
    }

    const clientName = selectedClient?.name ?? 'this client';
    const confirmed = window.confirm(
      `Deleting ${clientName} removes all associated workflows and run history. This cannot be undone.\n\nContinue?`,
    );

    if (!confirmed) {
      return;
    }

    deleteMutation.mutate();
  };

  const handleSaveWorkflows = () => {
    if (!selectedClientId || !workflowSelectionDirty) {
      return;
    }
    updateClientWorkflowsMutation.mutate(selectedClientWorkflowIds);
  };

  const handleResetPassword = () => {
    if (!selectedClientId) {
      return;
    }

    const defaultEmail = selectedClient?.emails?.[0]?.email ?? '';
    const input = window.prompt('Enter the client email to reset the password for:', defaultEmail);

    if (!input) {
      return;
    }

    const trimmedEmail = input.trim().toLowerCase();

    if (!emailPattern.test(trimmedEmail)) {
      setClientMessage('Enter a valid email address to reset the password.');
      return;
    }

    resetClientPasswordMutation.mutate(trimmedEmail);
  };

  const handleAddClientEmail = () => {
    setEmailUpdateError(null);
    setClientEmailDrafts((previous) => [...previous, { value: '' }]);
  };

  const handleAddNewClientEmail = () => {
    setCreateError(null);
    setNewClientEmails((previous) => [...previous, '']);
  };

  const handleNewClientEmailChange = (index: number, value: string) => {
    setCreateError(null);
    setNewClientEmails((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  };

  const handleRemoveNewClientEmail = (index: number) => {
    setCreateError(null);
    setNewClientEmails((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      return previous.filter((_, emailIndex) => emailIndex !== index);
    });
  };

  const handleUpdateClientEmailValue = (index: number, value: string) => {
    setEmailUpdateError(null);
    setClientEmailDrafts((previous) => {
      const next = [...previous];
      next[index] = { ...next[index], value };
      return next;
    });
  };

  const handleRemoveClientEmail = (index: number) => {
    setEmailUpdateError(null);
    setClientEmailDrafts((previous) => {
      if (previous.length <= 1) {
        return previous;
      }

      return previous.filter((_, entryIndex) => entryIndex !== index);
    });
  };

  const handleSaveClientEmails = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedClientId) {
      return;
    }

    const normalised = clientEmailDrafts
      .map((entry) => ({
        id: entry.id,
        email: entry.value.trim().toLowerCase(),
      }))
      .filter((entry) => entry.email.length > 0);

    if (!normalised.length) {
      setEmailUpdateError('Add at least one email address.');
      return;
    }

    const invalid = normalised.find((entry) => !emailPattern.test(entry.email));
    if (invalid) {
      setEmailUpdateError(`Enter a valid email address: ${invalid.email}`);
      return;
    }

    const seen = new Set<string>();
    for (const entry of normalised) {
      if (seen.has(entry.email)) {
        setEmailUpdateError('Email addresses must be unique.');
        return;
      }
      seen.add(entry.email);
    }

    updateClientEmailsMutation.mutate({
      emails: normalised.map((entry) => ({
        id: entry.id,
        email: entry.email,
      })),
    });
  };

  const handleSaveN8nSettings = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedBaseUrl = n8nBaseUrl.trim();
    const trimmedApiKey = n8nApiKeyInput.trim();

    if (!trimmedBaseUrl) {
      setSettingsError('n8n base URL is required.');
      setSettingsMessage(null);
      return;
    }

    const payload: { baseUrl: string; webhookBaseUrl?: string | null; apiKey?: string | null } = {
      baseUrl: trimmedBaseUrl,
    };

    if (clearApiKey) {
      payload.apiKey = null;
    } else if (trimmedApiKey) {
      payload.apiKey = trimmedApiKey;
    }

    updateN8nConfigMutation.mutate(payload);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Admin</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Workflow assignments</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Manage which n8n workflows each client can run in their dashboard. You can add or remove
              workflows at any time.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">n8n connection</h2>
              <p className="text-sm text-slate-600">
                Set the base URL and API key used for all client workflows. These apply across the entire dashboard.
              </p>
            </div>
            {n8nConfigQuery.isFetching ? (
              <span className="text-xs text-slate-500">Loading settings…</span>
            ) : null}
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleSaveN8nSettings}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="n8n-base-url" className="text-sm font-medium text-slate-700">
                  n8n base URL
                </label>
                <input
                  id="n8n-base-url"
                  type="url"
                  required
                  value={n8nBaseUrl}
                  onChange={(event) => setN8nBaseUrl(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="https://n8n.example.com/api/v1"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="n8n-api-key" className="text-sm font-medium text-slate-700">
                  n8n API key
                </label>
                <input
                  id="n8n-api-key"
                  type="password"
                  value={n8nApiKeyInput}
                  onChange={(event) => {
                    setN8nApiKeyInput(event.target.value);
                    if (event.target.value) {
                      setClearApiKey(false);
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Enter a new API key"
                  autoComplete="off"
                />
                {hasStoredApiKey && !n8nApiKeyInput ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Current key: {n8nConfigQuery.data?.apiKeyPreview ?? 'stored'}.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col justify-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={clearApiKey}
                    onChange={(event) => {
                      setClearApiKey(event.target.checked);
                      if (event.target.checked) {
                        setN8nApiKeyInput('');
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  Remove stored API key
                </label>
                <p className="text-xs text-slate-500">
                  When checked, the current API key will be deleted. Provide a new key to replace it instead.
                </p>
              </div>
            </div>

            {settingsError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {settingsError}
              </div>
            ) : null}
            {settingsMessage ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {settingsMessage}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={updateN8nConfigMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {updateN8nConfigMutation.isPending ? 'Saving…' : 'Save n8n settings'}
              </button>
              {n8nConfigQuery.isError ? (
                <span className="text-xs text-rose-600">
                  Unable to load current settings. Saving will overwrite them.
                </span>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Add a client</h2>
              <p className="text-sm text-slate-600">
                Choose the n8n workflows a client should see inside the dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen((prev) => !prev);
                setCreateError(null);
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
            >
              {isCreateOpen ? 'Cancel' : 'New client'}
            </button>
          </div>

          {isCreateOpen ? (
            <form className="mt-4 space-y-4" onSubmit={handleCreateClient}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="client-name" className="text-sm font-medium text-slate-700">
                      Client name
                    </label>
                    <input
                      id="client-name"
                      type="text"
                      value={newClientName}
                      onChange={(event) => setNewClientName(event.target.value)}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                  <div className="space-y-3">
                    <span className="text-sm font-medium text-slate-700">Client emails</span>
                    <div className="space-y-2">
                      {newClientEmails.map((value, index) => (
                        <div key={`new-client-email-${index}`} className="flex items-center gap-2">
                          <input
                            type="email"
                            value={value}
                            onChange={(event) => handleNewClientEmailChange(index, event.target.value)}
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            placeholder={
                              index === 0 ? 'client@example.com' : 'additional@example.com'
                            }
                            autoComplete="off"
                          />
                          {index > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveNewClientEmail(index)}
                              className="text-xs font-semibold text-rose-600 transition hover:text-rose-500"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddNewClientEmail}
                      className="text-xs font-semibold text-slate-600 transition hover:text-slate-800"
                    >
                      + Add another email
                    </button>
                    <p className="text-xs text-slate-500">
                      Every email receives its own login and password setup link.
                    </p>
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-700">Workflows</span>
                  <div className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200">
                    {availableWorkflowsQuery.isLoading ? (
                      <p className="px-3 py-2 text-sm text-slate-500">Loading workflows…</p>
                    ) : workflowOptions.length ? (
                      <ul className="divide-y divide-slate-100 text-sm">
                        {workflowOptions.map((workflow: N8nWorkflowOption) => (
                          <li key={workflow.id}>
                            <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50">
                              <input
                                type="checkbox"
                                checked={newClientWorkflowIds.includes(workflow.id)}
                                onChange={() => toggleNewClientWorkflow(workflow.id)}
                                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                              />
                              <span className="text-slate-700">{workflow.name}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-3 py-2 text-sm text-slate-500">No workflows found in n8n.</p>
                    )}
                  </div>
                  {availableWorkflowsQuery.isError ? (
                    <p className="mt-1 text-xs text-rose-600">
                      Unable to load workflows. Check your n8n credentials.
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <label htmlFor="client-description" className="text-sm font-medium text-slate-700">
                  Description (optional)
                </label>
                <textarea
                  id="client-description"
                  value={newClientDescription}
                  onChange={(event) => setNewClientDescription(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Short description of the client"
                />
              </div>

              {createError ? (
                <p className="text-sm font-medium text-rose-600" role="alert">
                  {createError}
                </p>
              ) : null}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={createClientMutation.isPending || availableWorkflowsQuery.isLoading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {createClientMutation.isPending ? 'Creating…' : 'Create client'}
                </button>
                {availableWorkflowsQuery.isLoading ? (
                  <p className="text-xs text-slate-500">Loading workflows…</p>
                ) : null}
              </div>
            </form>
          ) : null}
        </section>

        {clientsQuery.isError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            <p className="font-semibold">Unable to load clients.</p>
            <p className="mt-2 text-xs opacity-80">
              {clientsQuery.error instanceof Error
                ? clientsQuery.error.message
                : 'Check the backend logs for more information.'}
            </p>
          </div>
        ) : null}

        <section className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Clients</h2>
              <span className="text-xs text-slate-400">
                {clientsQuery.isLoading ? 'Loading…' : activeClients.length}
              </span>
            </div>
            <ul className="mt-4 space-y-2">
              {activeClients.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientId(client.id);
                      setClientMessage(null);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      client.id === selectedClientId
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <p className="font-medium">{client.name}</p>
                    {client.description ? (
                      <p className="text-xs opacity-80">{client.description}</p>
                    ) : null}
                    <p
                      className={`text-xs ${
                        client.emails.length ? 'text-slate-500' : 'text-slate-400 italic'
                      }`}
                    >
                      {describeLoginList(client)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>

            {archivedClients.length ? (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Archived
                  </h3>
                  <span className="text-xs text-slate-400">{archivedClients.length}</span>
                </div>
                <ul className="mt-2 space-y-2">
                  {archivedClients.map((client) => (
                    <li key={client.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClientId(client.id);
                          setClientMessage(null);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                          client.id === selectedClientId
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{client.name}</p>
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">
                            Archived
                          </span>
                        </div>
                        {client.description ? (
                          <p className="text-xs opacity-80">{client.description}</p>
                        ) : null}
                        <p
                          className={`text-xs ${
                            client.emails.length ? 'text-slate-500' : 'text-slate-400 italic'
                          }`}
                        >
                          {describeLoginList(client)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>

          <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedClient?.name ?? 'Select a client'}
                </h2>
                {selectedClient?.archivedAt ? (
                  <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Archived
                  </p>
                ) : null}
                {selectedClient?.description ? (
                  <p className="mt-2 text-sm text-slate-600">{selectedClient.description}</p>
                ) : null}
                <p
                  className={`mt-2 text-xs ${
                    selectedClient?.emails?.length ? 'text-slate-500' : 'text-slate-400 italic'
                  }`}
                >
                  {selectedClient ? describeLoginList(selectedClient) : 'Login email not set yet.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveWorkflows}
                  disabled={
                    !selectedClientId ||
                    !workflowSelectionDirty ||
                    updateClientWorkflowsMutation.isPending
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  title={updateClientWorkflowsMutation.isPending ? 'Saving…' : 'Save access'}
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  <span className="sr-only">Save access</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={!selectedClientId || resetClientPasswordMutation.isPending}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Reset password"
                >
                  <KeyIcon className="h-5 w-5" />
                  <span className="sr-only">Reset password</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedClientId) {
                      return;
                    }
                    syncClientWorkflowsMutation.mutate();
                  }}
                  disabled={syncClientWorkflowsMutation.isPending || !selectedClientId}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  title={
                    syncClientWorkflowsMutation.isPending
                      ? 'Syncing…'
                      : 'Sync workflows from n8n'
                  }
                  aria-label="Sync workflows from n8n"
                >
                  <ArrowPathIcon
                    className={`h-5 w-5 ${syncClientWorkflowsMutation.isPending ? 'animate-spin' : ''}`}
                  />
                </button>
                {selectedClient?.archivedAt ? (
                  <button
                    type="button"
                    onClick={handleUnarchive}
                    disabled={unarchiveMutation.isPending || !selectedClientId}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Unarchive client"
                  >
                    <ArrowUpTrayIcon className="h-5 w-5" />
                    <span className="sr-only">Unarchive client</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={archiveMutation.isPending || !selectedClientId}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Archive client"
                  >
                    <ArchiveBoxArrowDownIcon className="h-5 w-5" />
                    <span className="sr-only">Archive client</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending || !selectedClientId}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-200 text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Delete client"
                >
                  <TrashIcon className="h-5 w-5" />
                  <span className="sr-only">Delete client</span>
                </button>
              </div>
            </div>

            {selectedClient ? (
              <form
                className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                onSubmit={handleSaveClientEmails}
              >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Client emails</h3>
                  <p className="text-xs text-slate-500">
                    Everyone listed here can sign in. New addresses receive a link to choose their password.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddClientEmail}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                >
                  + Add email
                </button>
              </div>

              <div className="space-y-3">
                {clientEmailDrafts.map((entry, index) => (
                  <div
                    key={entry.id ?? `draft-${index}`}
                    className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center"
                  >
                    <input
                      type="email"
                      value={entry.value}
                      onChange={(event) => handleUpdateClientEmailValue(index, event.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      placeholder="contact@example.com"
                      autoComplete="off"
                    />
                    {clientEmailDrafts.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveClientEmail(index)}
                        className="text-xs font-semibold text-rose-600 transition hover:text-rose-500"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              {emailUpdateError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {emailUpdateError}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <button
                  type="submit"
                  disabled={
                    !selectedClientId || !clientEmailsDirty || updateClientEmailsMutation.isPending
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {updateClientEmailsMutation.isPending ? 'Saving…' : 'Save emails'}
                </button>
                {!clientEmailsDirty ? (
                  <span className="text-xs text-slate-400">No pending email changes.</span>
                ) : (
                  <span className="text-xs text-slate-500">
                    Changes save immediately for all contacts.
                  </span>
                )}
              </div>
              </form>
            ) : null}

            {workflowsQuery.isError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                <p className="font-semibold">Unable to load client workflows.</p>
                <p className="mt-2 text-xs opacity-80">
                  {workflowsQuery.error instanceof Error
                    ? workflowsQuery.error.message
                    : 'Refresh the page or check server logs for more information.'}
                </p>
              </div>
            ) : null}

            {clientMessage ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {clientMessage}
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Workflow access</h3>
                <span className="text-xs text-slate-500">
                  {selectedClientWorkflowIds.length} selected
                </span>
              </div>
              <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-slate-100">
                {availableWorkflowsQuery.isLoading && !workflowOptions.length ? (
                  <p className="px-3 py-2 text-sm text-slate-500">Loading workflows…</p>
                ) : workflowOptions.length ? (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {workflowOptions.map((workflow) => (
                      <li key={workflow.id}>
                        <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selectedClientWorkflowIds.includes(workflow.id)}
                            onChange={() => toggleSelectedClientWorkflow(workflow.id)}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                          />
                          <span className="text-slate-700">{workflow.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-2 text-sm text-slate-500">
                    No workflows are currently available from n8n.
                  </p>
                )}
              </div>
              {availableWorkflowsQuery.isError ? (
                <p className="mt-2 text-xs text-rose-600">
                  Unable to refresh the workflow list. Check the backend logs.
                </p>
              ) : null}
            </div>

            {workflowsQuery.isLoading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                <p className="text-sm text-slate-500">Loading workflow details…</p>
              </div>
            ) : (workflowsQuery.data?.workflows?.length ?? 0) > 0 ? (
              <div className="space-y-3">
                {(workflowsQuery.data?.workflows ?? []).map((workflow) => (
                  <div
                    key={workflow.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{workflow.name}</h3>
                        {workflow.description ? (
                          <p className="mt-1 text-sm text-slate-600">{workflow.description}</p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {workflow.n8nWorkflowId}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      Webhook URL:{' '}
                      <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        {workflow.webhookUrl || '—'}
                      </code>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Last run:{' '}
                      {workflow.lastRunAt
                        ? new Date(workflow.lastRunAt).toLocaleString()
                        : 'Not recorded yet'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="text-sm text-slate-600">
                  This client does not have any workflows yet. Select workflows above and save access to share automations with them.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
};
