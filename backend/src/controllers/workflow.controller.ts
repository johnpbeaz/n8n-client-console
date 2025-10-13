import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { isAxiosError } from 'axios';

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

  if (!workflow.webhookUrl) {
    res.status(502).json({ error: 'Workflow does not have a webhook configured' });
    return;
  }

  const storedMethod =
    typeof workflow.webhookMethod === 'string' && workflow.webhookMethod.length > 0
      ? workflow.webhookMethod.toUpperCase()
      : null;

  const fallbackMethods = ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'];
  const methodsToTry = [
    ...(storedMethod ? [storedMethod] : []),
    ...fallbackMethods,
  ].filter((method, index, arr) => arr.indexOf(method) === index);

  const attemptedMethods: string[] = [];
  let usedMethod: string | null = null;
  let responsePayload: unknown;
  let lastError: unknown;

  for (const method of methodsToTry) {
    attemptedMethods.push(method);
    try {
      const response = await triggerWebhook(
        workflow.webhookUrl,
        {
          ...req.body,
          metadata: auditPayload,
        },
        method,
      );
      usedMethod = method;
      responsePayload = response;
      break;
    } catch (error) {
      lastError = error;
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404 || status === 405) {
          continue;
        }
      }
      break;
    }
  }

  const runRequestPayload = {
    ...auditPayload,
    httpMethod: usedMethod,
    attemptedMethods,
  } as Prisma.InputJsonObject;

  if (usedMethod) {
    const run = await prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        clientId: workflow.clientId,
        status: 'success',
        responsePayload: (responsePayload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        requestPayload: runRequestPayload,
      },
    });

    await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        lastRunAt: run.createdAt,
        webhookMethod: usedMethod,
      },
    });

    res.json({ success: true, response: responsePayload });
    return;
  }

  const failurePayload =
    lastError instanceof Error
      ? { message: lastError.message }
      : { error: String(lastError) };

  const run = await prisma.workflowRun.create({
    data: {
      workflowId: workflow.id,
      clientId: workflow.clientId,
      status: 'failed',
      responsePayload: failurePayload as Prisma.InputJsonValue,
      requestPayload: runRequestPayload,
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
    details: lastError instanceof Error ? lastError.message : 'Unknown error',
  });
};
