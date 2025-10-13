import axios, { type AxiosRequestConfig, type AxiosInstance } from 'axios';

import { getN8nConfig } from './settings.service';

const normaliseBaseUrl = (value?: string | null) => {
  if (!value) {
    return null;
  }
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const buildHeaders = (apiKey: string) => ({
  'X-N8n-Api-Key': apiKey,
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

const createApiClient = (baseUrl: string, apiKey: string): AxiosInstance =>
  axios.create({
    baseURL: baseUrl,
    headers: buildHeaders(apiKey),
    timeout: 10_000,
  });

const requireN8nConfig = async () => {
  const config = await getN8nConfig();
  if (!config.baseUrl || !config.apiKey) {
    throw new Error('n8n API configuration not provided. Set it in admin settings.');
  }

  const webhookBase = normaliseBaseUrl(
    config.webhookBaseUrl ?? config.baseUrl.replace(/\/api\/v1\/?$/, ''),
  );

  return {
    ...config,
    webhookBaseUrl: webhookBase,
    client: createApiClient(config.baseUrl, config.apiKey),
  };
};

export const triggerWebhook = async (webhookUrl: string, payload: unknown, method = 'POST') => {
  const httpMethod = method.toUpperCase();
  const config: AxiosRequestConfig = {
    url: webhookUrl,
    method: httpMethod,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
  };

  if (httpMethod === 'GET' || httpMethod === 'DELETE') {
    config.params = payload as Record<string, unknown>;
  } else {
    config.data = payload;
  }

  const response = await axios.request(config);

  return response.data;
};

export interface N8nWorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  tags?: Array<{ id: string; name: string }>;
  nodes?: Array<unknown>;
  projectId?: string | null;
  webhookUrl?: string | null;
  webhookMethod?: string | null;
}

const extractWebhookInfo = (workflow: any, resolvedWebhookBaseUrl: string | null) => {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const webhookNode = nodes.find((node: any) => node?.type === 'n8n-nodes-base.webhook');
  const path = webhookNode?.parameters?.path;
  const methodParam = webhookNode?.parameters?.httpMethod;
  const method =
    typeof methodParam === 'string' && methodParam.length > 0 ? methodParam.toUpperCase() : null;

  if (!path || !resolvedWebhookBaseUrl) {
    return null;
  }

  const url = `${resolvedWebhookBaseUrl}/webhook/${path}`;

  return { url, method };
};

export const listWorkflowsInProject = async (projectId?: string | null) => {
  const { client, webhookBaseUrl } = await requireN8nConfig();

  const response = await client.get('/workflows');
  const data = response.data?.data ?? response.data;
  const workflows = Array.isArray(data) ? data : [];

  return workflows
    .filter((workflow: any) => {
      const matchesProject = projectId
        ? workflow.shared?.some((share: any) => share.projectId === projectId)
        : true;
      const isArchived = workflow.isArchived === true || workflow.status === 'archived';
      const isActive =
        workflow.active === true || workflow.status === 'active' || workflow.state === 'active';

      return matchesProject && !isArchived && isActive;
    })
    .map((workflow: any) => {
      const webhookInfo = extractWebhookInfo(workflow, webhookBaseUrl);
      return {
        ...workflow,
        projectId: workflow.shared?.[0]?.projectId ?? null,
        webhookUrl: webhookInfo?.url ?? null,
        webhookMethod: webhookInfo?.method ?? null,
      } as N8nWorkflowSummary;
    })
    .filter((workflow: N8nWorkflowSummary) => Boolean(workflow.webhookUrl));
};

export const listProjects = async () => {
  const { client } = await requireN8nConfig();

  try {
    const response = await client.get('/projects');
    const data = response.data?.data ?? response.data;
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (error) {
    // Some n8n plans restrict project listing; fall back to deriving folders from workflows.
  }

  const workflowsResponse = await client.get('/workflows');
  const workflowData = workflowsResponse.data?.data ?? workflowsResponse.data;
  const workflows = Array.isArray(workflowData) ? workflowData : [];

  const projectsMap = new Map<string, { id: string; name: string }>();
  const projectFirstWorkflow = new Map<string, string>();

  workflows.forEach((workflow: any) => {
    const shares = Array.isArray(workflow.shared) ? workflow.shared : [];

    shares.forEach((share: any) => {
      if (!share?.projectId) {
        return;
      }

      const id = String(share.projectId);
      if (!projectFirstWorkflow.has(id) && workflow.id) {
        projectFirstWorkflow.set(id, String(workflow.id));
      }

      if (!projectsMap.has(id)) {
        const derivedName =
          share?.project?.name ??
          share?.projectName ??
          (workflow.projectName as string | undefined) ??
          `Folder ${id.slice(0, 8)}`;

        projectsMap.set(id, {
          id,
          name: derivedName,
        });
      }
    });
  });

  if (projectsMap.size === 0) {
    return [];
  }

  const enrichedProjects = await Promise.all(
    Array.from(projectsMap.entries()).map(async ([projectId, fallbackProject]) => {
      const workflowId = projectFirstWorkflow.get(projectId);

      if (!workflowId) {
        return fallbackProject;
      }

      try {
        const workflowResponse = await client.get(`/workflows/${workflowId}`);
        const workflow = workflowResponse.data;
        const matchingShare = Array.isArray(workflow.shared)
          ? workflow.shared.find((share: any) => String(share.projectId) === projectId)
          : null;
        const project = matchingShare?.project;

        if (project?.type && project.type !== 'personal') {
          return null;
        }

        if (project?.name) {
          return { id: projectId, name: project.name };
        }
      } catch (error) {
        // Ignore detail fetch errors and fall back to derived name.
      }

      return fallbackProject;
    }),
  );

  return enrichedProjects.filter((project): project is { id: string; name: string } => Boolean(project));
};

export const listAllWorkflows = async () => listWorkflowsInProject(null);

export const getWorkflowById = async (workflowId: string) => {
  const { client } = await requireN8nConfig();

  const response = await client.get(`/workflows/${workflowId}`);
  return response.data;
};
