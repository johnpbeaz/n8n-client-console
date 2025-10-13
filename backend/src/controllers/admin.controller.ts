import type { Request, Response } from 'express';
import { z } from 'zod';

import type { Prisma, User } from '@prisma/client';
import { PasswordTokenType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { getWorkflowById, listAllWorkflows, listProjects, listWorkflowsInProject } from '../services/n8n.service';
import { canSendClientEmails, sendPasswordEmail } from '../services/mail.service';
import { createPasswordToken } from '../services/password-token.service';

const emailSchema = z.string().email().transform((value) => value.trim().toLowerCase());

const createClientSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    n8nProjectId: z.string().optional(),
    emails: z.array(emailSchema).optional(),
    email: emailSchema.optional(),
    workflowIds: z.array(z.string().min(1)).optional(),
  })
  .refine((data) => (data.emails?.length ?? 0) > 0 || Boolean(data.email), {
    message: 'At least one email is required',
    path: ['emails'],
  });

const updateClientWorkflowsSchema = z.object({
  workflowIds: z.array(z.string().min(1)).default([]),
});

const resetClientPasswordSchema = z.object({
  email: z.string().email(),
});

const clientEmailInputSchema = z.object({
  id: z.string().uuid().optional(),
  email: emailSchema,
});

const updateClientEmailsSchema = z.object({
  emails: z.array(clientEmailInputSchema).min(1, 'At least one email is required.'),
});

const clientInclude = {
  emails: {
    include: {
      user: true,
    },
    orderBy: [{ createdAt: 'asc' }] as Prisma.ClientEmailOrderByWithRelationInput[],
  },
};

type ClientWithRelations = Prisma.ClientGetPayload<{ include: typeof clientInclude }>;

const serializeClient = (client: ClientWithRelations) => {
  const emails = client.emails.map((email) => ({
    id: email.id,
    email: email.email,
    userId: email.userId,
  }));

  const primaryEmail = emails[0]?.email ?? null;

  return {
    id: client.id,
    name: client.name,
    description: client.description,
    n8nProjectId: client.n8nProjectId,
    archivedAt: client.archivedAt,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    emails,
    primaryUserEmail: primaryEmail,
  };
};

type InvitationResult = {
  email: string;
  emailed: boolean;
  setupUrl: string | null;
};

const buildPasswordSetupUrl = (token: string) => {
  const url = new URL('/password/setup', env.appBaseUrl);
  url.searchParams.set('token', token);
  return url.toString();
};

const inviteUserToSetPassword = async (user: User, clientName: string): Promise<InvitationResult> => {
  const { token, expiresAt } = await createPasswordToken(user.id, PasswordTokenType.setup);
  const setupUrl = buildPasswordSetupUrl(token);

  if (!canSendClientEmails()) {
    return { email: user.email, emailed: false, setupUrl };
  }

  try {
    await sendPasswordEmail({
      to: user.email,
      clientName,
      setupUrl,
      expiresAt,
      mode: 'setup',
    });
    return { email: user.email, emailed: true, setupUrl: null };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to send password setup email', error);
    return { email: user.email, emailed: false, setupUrl };
  }
};

const generateTemporaryPassword = () => {
  const candidate = randomBytes(12)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 12);

  return candidate.length >= 8 ? candidate : randomBytes(6).toString('hex');
};

const assignWorkflowsToClient = async (clientId: string, workflowIds: string[]) => {
  const uniqueWorkflowIds = Array.from(new Set(workflowIds));

  if (!uniqueWorkflowIds.length) {
    await prisma.$transaction([
      prisma.workflowRun.deleteMany({
        where: { clientId },
      }),
      prisma.workflow.deleteMany({
        where: { clientId },
      }),
    ]);
    return;
  }

  const allWorkflows = await listAllWorkflows();
  const workflowsMap = new Map<string, any>(
    allWorkflows.map((workflow: any) => [String(workflow.id), workflow]),
  );

  const resolvedWorkflows: any[] = [];

  for (const workflowId of uniqueWorkflowIds) {
    let workflow = workflowsMap.get(workflowId);
    if (!workflow) {
      try {
        workflow = await getWorkflowById(workflowId);
      } catch (error) {
        // eslint-disable-next-line no-continue
        continue;
      }
    }

    if (workflow) {
      resolvedWorkflows.push(workflow);
    }
  }

  const resolvedIds = resolvedWorkflows.map((workflow) => String(workflow.id));

  if (!resolvedIds.length) {
    throw new Error('No matching workflows found in n8n for the provided IDs.');
  }

  const removalPredicate = resolvedIds.length
    ? {
        clientId,
        n8nWorkflowId: { notIn: resolvedIds },
      }
    : undefined;

  const operations: Prisma.PrismaPromise<unknown>[] = [];

  if (removalPredicate) {
    operations.push(
      prisma.workflowRun.deleteMany({
        where: {
          clientId,
          workflow: {
            n8nWorkflowId: { notIn: resolvedIds },
          },
        },
      }),
    );

    operations.push(prisma.workflow.deleteMany({ where: removalPredicate }));
  }

  resolvedWorkflows.forEach((workflow) => {
    operations.push(
      prisma.workflow.upsert({
        where: { n8nWorkflowId: String(workflow.id) },
        update: {
          clientId,
          name: workflow.name,
          description: workflow.description ?? null,
          webhookUrl: (workflow.webhookUrl as string | null) ?? '',
          webhookMethod: (workflow.webhookMethod as string | null) ?? null,
          n8nProjectId:
            workflow.shared?.[0]?.projectId ??
            workflow.projectId ??
            workflow.defaultProjectId ??
            null,
        },
        create: {
          clientId,
          name: workflow.name,
          description: workflow.description ?? null,
          webhookUrl: (workflow.webhookUrl as string | null) ?? '',
          webhookMethod: (workflow.webhookMethod as string | null) ?? null,
          n8nWorkflowId: String(workflow.id),
          n8nProjectId:
            workflow.shared?.[0]?.projectId ??
            workflow.projectId ??
            workflow.defaultProjectId ??
            null,
        },
      }),
    );
  });

  await prisma.$transaction(operations);
};

const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  webhookUrl: z.string().url('Webhook URL must be a valid URL').optional(),
});

export const listClients = async (req: Request, res: Response) => {
  const includeArchived = req.query.includeArchived === 'true';

  const clients = await prisma.client.findMany({
    where: includeArchived
      ? undefined
      : {
          archivedAt: null,
        },
    include: clientInclude,
    orderBy: [
      { archivedAt: { sort: 'asc', nulls: 'first' } },
      { name: 'asc' },
    ],
  });

  res.json({ clients: clients.map(serializeClient) });
};

export const createClient = async (req: Request, res: Response) => {
  const parseResult = createClientSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid client payload', details: parseResult.error.flatten() });
    return;
  }

  const { workflowIds = [], email, emails, ...clientData } = parseResult.data;
  const candidateEmails = emails && emails.length ? emails : email ? [email] : [];
  const uniqueEmails = Array.from(new Set(candidateEmails.map((value) => value.trim().toLowerCase())));

  if (!uniqueEmails.length) {
    res.status(400).json({ error: 'At least one client email is required.' });
    return;
  }

  const existingUsers = await prisma.user.findMany({
    where: {
      email: { in: uniqueEmails },
    },
    select: { email: true },
  });

  if (existingUsers.length) {
    res.status(409).json({
      error: `A user with email ${existingUsers[0].email} already exists`,
    });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({ data: clientData });
    const users: User[] = [];

    for (const address of uniqueEmails) {
      const passwordHash = await bcrypt.hash(generateTemporaryPassword(), 12);
      const user = await tx.user.create({
        data: {
          email: address,
          name: client.name,
          passwordHash,
          role: 'client',
          clientId: client.id,
        },
      });

      await tx.clientEmail.create({
        data: {
          clientId: client.id,
          userId: user.id,
          email: address,
        },
      });

      users.push(user);
    }

    return { client, users };
  });

  try {
    if (workflowIds.length) {
      await assignWorkflowsToClient(result.client.id, workflowIds);
    }
  } catch (error) {
    await prisma.user.deleteMany({ where: { id: { in: result.users.map((user) => user.id) } } });
    await prisma.client.delete({ where: { id: result.client.id } });
    res.status(502).json({
      error: 'Failed to assign workflows to the new client',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }

  const clientWithRelations = await prisma.client.findUnique({
    where: { id: result.client.id },
    include: clientInclude,
  });

  if (!clientWithRelations) {
    res.status(500).json({ error: 'Failed to load client after creation.' });
    return;
  }

  const invitations = await Promise.all(
    result.users.map((user) => inviteUserToSetPassword(user, result.client.name)),
  );

  res.status(201).json({
    client: serializeClient(clientWithRelations),
    invitations,
  });
};

export const archiveClient = async (req: Request, res: Response) => {
  const { clientId } = req.params;

  const client = await prisma.client.update({
    where: { id: clientId },
    data: {
      archivedAt: new Date(),
    },
    include: clientInclude,
  });

  res.json({ client: serializeClient(client) });
};

export const unarchiveClient = async (req: Request, res: Response) => {
  const { clientId } = req.params;

  const client = await prisma.client.update({
    where: { id: clientId },
    data: {
      archivedAt: null,
    },
    include: clientInclude,
  });

  res.json({ client: serializeClient(client) });
};

export const deleteClient = async (req: Request, res: Response) => {
  const { clientId } = req.params;

  await prisma.workflowRun.deleteMany({
    where: { clientId },
  });

  await prisma.workflow.deleteMany({
    where: { clientId },
  });

  await prisma.user.updateMany({
    where: { clientId },
    data: { clientId: null },
  });

  await prisma.client.delete({
    where: { id: clientId },
  });

  res.status(204).send();
};

export const listClientWorkflows = async (req: Request, res: Response) => {
  const { clientId } = req.params;

  const workflows = await prisma.workflow.findMany({
    where: { clientId },
    orderBy: { name: 'asc' },
  });

  res.json({ workflows });
};

export const syncClientWorkflows = async (req: Request, res: Response) => {
  const { clientId } = req.params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  try {
    const externalWorkflows = await listWorkflowsInProject(client.n8nProjectId);

    const operations = externalWorkflows.map((workflow) => {
      const method =
        typeof workflow.webhookMethod === 'string' && workflow.webhookMethod.length > 0
          ? workflow.webhookMethod.toUpperCase()
          : null;

      return prisma.workflow.upsert({
        where: { n8nWorkflowId: String(workflow.id) },
        update: {
          name: workflow.name,
          clientId: client.id,
          n8nProjectId: workflow.projectId ?? client.n8nProjectId,
          webhookUrl: (workflow.webhookUrl as string | null) ?? '',
          webhookMethod: method,
        },
        create: {
          name: workflow.name,
          n8nWorkflowId: String(workflow.id),
          clientId: client.id,
          description: null,
          webhookUrl: (workflow.webhookUrl as string | null) ?? '',
          webhookMethod: method,
          n8nProjectId: workflow.projectId ?? client.n8nProjectId,
        },
      });
    });

    const synced = await prisma.$transaction(operations);

    res.json({
      synced: synced.length,
      workflows: synced,
    });
  } catch (error) {
    res.status(502).json({
      error: 'Failed to sync workflows from n8n',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const updateWorkflow = async (req: Request, res: Response) => {
  const { workflowId } = req.params;
  const parseResult = updateWorkflowSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid workflow payload', details: parseResult.error.flatten() });
    return;
  }

  const workflow = await prisma.workflow.update({
    where: { id: workflowId },
    data: parseResult.data,
  });

  res.json({ workflow });
};

export const updateClientWorkflows = async (req: Request, res: Response) => {
  const { clientId } = req.params;
  const parseResult = updateClientWorkflowsSchema.safeParse(req.body);

  if (!parseResult.success) {
    res
      .status(400)
      .json({ error: 'Invalid workflow selection', details: parseResult.error.flatten() });
    return;
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });

  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  try {
    await assignWorkflowsToClient(clientId, parseResult.data.workflowIds);
  } catch (error) {
    res.status(502).json({
      error: 'Failed to update client workflows',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }

  const workflows = await prisma.workflow.findMany({
    where: { clientId },
    orderBy: { name: 'asc' },
  });

  res.json({ workflows });
};

export const updateClientEmails = async (req: Request, res: Response) => {
  const { clientId } = req.params;
  const parseResult = updateClientEmailsSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid email payload', details: parseResult.error.flatten() });
    return;
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      emails: {
        include: { user: true },
      },
    },
  });

  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const incoming = parseResult.data.emails
    .map((entry) => ({
      id: entry.id ?? null,
      email: entry.email.trim().toLowerCase(),
    }))
    .filter((entry) => entry.email.length > 0);

  if (!incoming.length) {
    res.status(400).json({ error: 'Add at least one email address.' });
    return;
  }

  const seenEmails = new Set<string>();
  for (const entry of incoming) {
    if (seenEmails.has(entry.email)) {
      res.status(400).json({ error: 'Email addresses must be unique.' });
      return;
    }
    seenEmails.add(entry.email);
  }

  const existingById = new Map(client.emails.map((email) => [email.id, email]));

  for (const entry of incoming) {
    if (entry.id && !existingById.has(entry.id)) {
      res.status(404).json({ error: 'One of the provided emails could not be found.' });
      return;
    }
  }

  const toRemove = client.emails.filter(
    (email) => !incoming.some((entry) => entry.id === email.id),
  );

  const toCreate = incoming.filter((entry) => !entry.id);

  const toUpdate = incoming.filter((entry) => {
    if (!entry.id) {
      return false;
    }
    const current = existingById.get(entry.id);
    return current ? current.email.toLowerCase() !== entry.email : false;
  });

  const emailsToValidate = [
    ...toCreate.map((entry) => entry.email),
    ...toUpdate.map((entry) => entry.email),
  ];

  if (emailsToValidate.length) {
    const allowedUserIds = new Set(
      toUpdate.map((entry) => existingById.get(entry.id as string)?.userId).filter(Boolean) as string[],
    );

    const conflictingUsers = await prisma.user.findMany({
      where: {
        email: { in: emailsToValidate },
        NOT: {
          id: { in: Array.from(allowedUserIds) },
        },
      },
      select: { email: true },
    });

    if (conflictingUsers.length) {
      res.status(409).json({ error: `A user with email ${conflictingUsers[0].email} already exists` });
      return;
    }
  }

  const usersNeedingInvite: User[] = [];

  await prisma.$transaction(async (tx) => {
    for (const email of toRemove) {
      await tx.clientEmail.delete({ where: { id: email.id } });
      await tx.user.delete({ where: { id: email.userId } });
    }

    for (const entry of toUpdate) {
      const current = existingById.get(entry.id as string);
      if (!current) {
        continue;
      }
      const passwordHash = await bcrypt.hash(generateTemporaryPassword(), 12);
      const user = await tx.user.update({
        where: { id: current.userId },
        data: {
          email: entry.email,
          passwordHash,
          name: client.name,
        },
      });

      await tx.clientEmail.update({
        where: { id: current.id },
        data: { email: entry.email },
      });

      usersNeedingInvite.push(user);
    }

    for (const entry of toCreate) {
      const passwordHash = await bcrypt.hash(generateTemporaryPassword(), 12);
      const user = await tx.user.create({
        data: {
          email: entry.email,
          name: client.name,
          passwordHash,
          role: 'client',
          clientId: client.id,
        },
      });

      await tx.clientEmail.create({
        data: {
          clientId: client.id,
          userId: user.id,
          email: entry.email,
        },
      });

      usersNeedingInvite.push(user);
    }
  });

  const updatedClient = await prisma.client.findUnique({
    where: { id: clientId },
    include: clientInclude,
  });

  if (!updatedClient) {
    res.status(404).json({ error: 'Client not found after update' });
    return;
  }

  const invitations = await Promise.all(
    usersNeedingInvite.map((user) => inviteUserToSetPassword(user, updatedClient.name)),
  );

  res.json({ client: serializeClient(updatedClient), invitations });
};

export const resetClientPassword = async (req: Request, res: Response) => {
  const { clientId } = req.params;
  const parseResult = resetClientPasswordSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten() });
    return;
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const normalisedEmail = parseResult.data.email.trim().toLowerCase();

  const clientUser = await prisma.user.findFirst({
    where: {
      clientId,
      email: normalisedEmail,
      role: 'client',
    },
  });

  if (!clientUser) {
    res.status(404).json({ error: 'Client user with that email was not found' });
    return;
  }

  const passwordHash = await bcrypt.hash(generateTemporaryPassword(), 12);

  await prisma.user.update({
    where: { id: clientUser.id },
    data: { passwordHash },
  });

  const { token, expiresAt } = await createPasswordToken(clientUser.id, PasswordTokenType.setup);
  const setupUrl = buildPasswordSetupUrl(token);

  if (!canSendClientEmails()) {
    res.json({ invitation: { email: clientUser.email, emailed: false, setupUrl } });
    return;
  }

  try {
    await sendPasswordEmail({
      to: clientUser.email,
      clientName: client.name,
      setupUrl,
      expiresAt,
      mode: 'reset',
    });
    res.json({ invitation: { email: clientUser.email, emailed: true, setupUrl: null } });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to send password reset email', error);
    res.json({ invitation: { email: clientUser.email, emailed: false, setupUrl } });
  }
};

export const listN8nProjects = async (_req: Request, res: Response) => {
  try {
    const projects = await listProjects();

    res.json({
      projects: projects.map((project: any) => ({
        id: String(project.id ?? project.projectId ?? project.name),
        name: project.name ?? project.label ?? 'Untitled project',
      })),
    });
  } catch (error) {
    res.status(502).json({
      error: 'Failed to load n8n folders',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const listN8nWorkflows = async (_req: Request, res: Response) => {
  try {
    const workflows = await listAllWorkflows();

    res.json({
      workflows: workflows.map((workflow: any) => ({
        id: String(workflow.id),
        name: workflow.name ?? 'Untitled workflow',
        projectId:
          workflow.shared?.[0]?.projectId ??
          workflow.projectId ??
          workflow.defaultProjectId ??
          null,
      })),
    });
  } catch (error) {
    res.status(502).json({
      error: 'Failed to load workflows from n8n',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
