import type { Request, Response } from 'express';

import { prisma } from '../lib/prisma';

export const getMyWorkflows = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'client') {
    res.status(403).json({ error: 'Client role required' });
    return;
  }

  if (!req.user.clientId) {
    res.status(400).json({ error: 'Client account is not linked to a workspace' });
    return;
  }

  const workflows = await prisma.workflow.findMany({
    where: { clientId: req.user.clientId },
    orderBy: { name: 'asc' },
  });

  res.json({
    workflows: workflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      webhookUrl: workflow.webhookUrl,
      webhookMethod: workflow.webhookMethod,
      n8nWorkflowId: workflow.n8nWorkflowId,
      lastRunAt: workflow.lastRunAt,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    })),
  });
};

export const getMyWorkflowRuns = async (req: Request, res: Response) => {
  if (!req.user || req.user.role !== 'client' || !req.user.clientId) {
    res.status(403).json({ error: 'Client access required' });
    return;
  }

  const workflowId = req.params.workflowId;

  const runs = await prisma.workflowRun.findMany({
    where: {
      clientId: req.user.clientId,
      workflowId,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({ runs });
};
