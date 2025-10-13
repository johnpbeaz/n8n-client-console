import type { Request, Response } from 'express';
import { z } from 'zod';

import { getN8nConfig, updateN8nConfig } from '../services/settings.service';

const optionalUrl = z
  .union([z.string().trim().url(), z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .optional();

const optionalSecret = z
  .union([z.string().trim(), z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .optional();

const updateSchema = z.object({
  baseUrl: optionalUrl,
  apiKey: optionalSecret,
  webhookBaseUrl: optionalUrl,
});

const buildResponse = (config: Awaited<ReturnType<typeof getN8nConfig>>) => ({
  baseUrl: config.baseUrl,
  webhookBaseUrl: config.webhookBaseUrl,
  hasApiKey: Boolean(config.apiKey),
  apiKeyPreview: config.apiKey
    ? `${config.apiKey.slice(0, 4)}…${config.apiKey.slice(-4)}`
    : null,
});

export const getN8nSettings = async (_req: Request, res: Response) => {
  const config = await getN8nConfig();
  res.json(buildResponse(config));
};

export const updateN8nSettings = async (req: Request, res: Response) => {
  const parseResult = updateSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid settings payload', details: parseResult.error.flatten() });
    return;
  }

  const { baseUrl, apiKey, webhookBaseUrl } = parseResult.data;

  if (baseUrl !== undefined && baseUrl === null) {
    res.status(400).json({ error: 'n8n base URL cannot be empty' });
    return;
  }

  const nextConfig = await updateN8nConfig({
    baseUrl: baseUrl ?? undefined,
    apiKey: apiKey ?? undefined,
    webhookBaseUrl: webhookBaseUrl ?? undefined,
  });

  res.json(buildResponse(nextConfig));
};
