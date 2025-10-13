import type {
  AuthenticatedUser,
  Client,
  Invitation,
  N8nConfig,
  N8nWorkflowOption,
  Workflow,
  WorkflowRun,
} from '../types';

type CreateClientPayload = {
  name: string;
  description?: string;
  emails: string[];
  workflowIds?: string[];
};

type CreateClientResponse = {
  client: Client;
  invitations: Invitation[];
};

type UpdateClientEmailsPayload = {
  emails: { id?: string; email: string }[];
};

type UpdateClientEmailsResponse = {
  client: Client;
  invitations: Invitation[];
};

type ResetClientPasswordResponse = {
  invitation: Invitation;
};

type UpdateN8nConfigPayload = {
  baseUrl: string;
  webhookBaseUrl?: string | null;
  apiKey?: string | null;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

const buildUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalisedPath}`;
};

interface RequestOptions extends RequestInit {
  token?: string | null;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export const request = async <TResponse>(
  path: string,
  { token, headers, ...init }: RequestOptions = {},
): Promise<TResponse> => {
  const target = buildUrl(path);

  const response = await fetch(target, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : response.statusText;
    throw new ApiError(message ?? 'Request failed', response.status, data);
  }

  return data as TResponse;
};

export const api = {
  auth: {
    login: (payload: { email: string; password: string }) =>
      request<{ token: string; user: AuthenticatedUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    me: (token: string) => request<AuthenticatedUser>('/auth/me', { token }),
    completePasswordSetup: (payload: { token: string; password: string }) =>
      request<{ success: boolean }>('/auth/password/setup', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  client: {
    workflows: (token: string) => request<{ workflows: Workflow[] }>('/clients/me/workflows', { token }),
    workflowRuns: (workflowId: string, token: string) =>
      request<{ runs: WorkflowRun[] }>(`/clients/me/workflows/${workflowId}/runs`, { token }),
  },
  admin: {
    clients: (token: string, options: { includeArchived?: boolean } = {}) =>
      request<{ clients: Client[] }>(
        `/admin/clients${options.includeArchived ? '?includeArchived=true' : ''}`,
        { token },
      ),
    clientWorkflows: (clientId: string, token: string) =>
      request<{ workflows: Workflow[] }>(`/admin/clients/${clientId}/workflows`, { token }),
    createClient: (payload: CreateClientPayload, token: string) =>
      request<CreateClientResponse>('/admin/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
        token,
      }),
    archiveClient: (clientId: string, token: string) =>
      request<{ client: Client }>(`/admin/clients/${clientId}/archive`, {
        method: 'POST',
        token,
      }),
    unarchiveClient: (clientId: string, token: string) =>
      request<{ client: Client }>(`/admin/clients/${clientId}/unarchive`, {
        method: 'POST',
        token,
      }),
    deleteClient: (clientId: string, token: string) =>
      request<void>(`/admin/clients/${clientId}`, {
        method: 'DELETE',
        token,
      }),
    updateClientWorkflows: (clientId: string, workflowIds: string[], token: string) =>
      request<{ workflows: Workflow[] }>(`/admin/clients/${clientId}/workflows`, {
        method: 'PUT',
        body: JSON.stringify({ workflowIds }),
        token,
      }),
    updateClientEmails: (clientId: string, payload: UpdateClientEmailsPayload, token: string) =>
      request<UpdateClientEmailsResponse>(`/admin/clients/${clientId}/emails`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        token,
      }),
    resetClientPassword: (clientId: string, email: string, token: string) =>
      request<ResetClientPasswordResponse>(`/admin/clients/${clientId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ email }),
        token,
      }),
    n8nWorkflows: (token: string) => request<{ workflows: N8nWorkflowOption[] }>('/admin/n8n/workflows', { token }),
    getN8nConfig: (token: string) => request<N8nConfig>('/admin/n8n/config', { token }),
    updateN8nConfig: (payload: UpdateN8nConfigPayload, token: string) =>
      request<N8nConfig>('/admin/n8n/config', {
        method: 'PUT',
        body: JSON.stringify(payload),
        token,
      }),
  },
  workflows: {
    trigger: (workflowId: string, token: string, payload: unknown = {}) =>
      request<{ success: boolean; response: unknown }>(`/workflows/${workflowId}/run`, {
        method: 'POST',
        body: JSON.stringify(payload),
        token,
      }),
  },
};
