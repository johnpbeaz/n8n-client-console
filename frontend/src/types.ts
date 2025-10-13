export type Role = 'client' | 'admin';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  clientId?: string | null;
  clientName?: string | null;
}

export interface ClientEmail {
  id: string;
  email: string;
  userId: string;
}

export interface Invitation {
  email: string;
  emailed: boolean;
  setupUrl: string | null;
}

export interface Client {
  id: string;
  name: string;
  description?: string | null;
  n8nProjectId?: string | null;
  archivedAt?: string | null;
  primaryUserEmail?: string | null;
  emails: ClientEmail[];
  createdAt: string;
  updatedAt: string;
}

export interface N8nWorkflowOption {
  id: string;
  name: string;
  projectId?: string | null;
}

export interface Workflow {
  id: string;
  clientId: string;
  name: string;
  description?: string | null;
  webhookUrl: string;
  webhookMethod?: string | null;
  n8nWorkflowId: string;
  n8nProjectId?: string | null;
  lastRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface N8nConfig {
  baseUrl: string | null;
  webhookBaseUrl: string | null;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  clientId?: string | null;
  status: 'success' | 'failed';
  requestPayload: unknown;
  responsePayload?: unknown;
  createdAt: string;
  updatedAt: string;
}
