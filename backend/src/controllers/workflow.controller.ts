import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { triggerWebhook } from '../services/n8n.service';

const buildAuditPayload = (body: unknown, user: Express.Request['user']): Prisma.InputJsonObject => {
  return {
    input: body ?? null,
    triggeredBy: user
      ? {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
        }
      : null,
    triggeredAt: new Date().toISOString(),
  } satisfies Prisma.InputJsonObject;
};

export const triggerWorkflow = async (req: Request, res: Response) => {
  const { workflowId } = req.params;
  const user = req.user;

  if (!workflowId) {
    res.status(400).json({ error: 'Missing workflowId parameter' });
    return;
  }

  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }

  if (user.role === 'client' && workflow.clientId !== user.clientId) {
    res.status(403).json({ error: 'Workflow does not belong to your account' });
    return;
  }

  const auditPayload = buildAuditPayload(req.body, user);

  try {
    if (!workflow.webhookUrl) {
      res.status(502).json({ error: 'Workflow does not have a webhook configured' });
      return;
    }

    const response = await triggerWebhook(
      workflow.webhookUrl,
      {
        ...req.body,
        metadata: auditPayload,
      },
      workflow.webhookMethod ?? 'POST',
    );

    const run = await prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        clientId: workflow.clientId,
        status: 'success',
        responsePayload: (response ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        requestPayload: auditPayload,
      },
    });

    await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        lastRunAt: run.createdAt,
      },
    });

    res.json({ success: true, response });
  } catch (error) {
    const failurePayload =
      error instanceof Error
        ? { message: error.message }
        : { error: String(error) };

    const run = await prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        clientId: workflow.clientId,
        status: 'failed',
        responsePayload: failurePayload as Prisma.InputJsonValue,
        requestPayload: auditPayload,
      },
    });

    await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        lastRunAt: run.createdAt,
      },
    });

    res.status(502).json({
      error: 'Failed to trigger workflow',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
