import { prisma } from '../lib/prisma';
import { env } from '../config/env';

const SETTING_KEYS = {
  n8nBaseUrl: 'n8nBaseUrl',
  n8nApiKey: 'n8nApiKey',
  n8nWebhookBaseUrl: 'n8nWebhookBaseUrl',
} as const;

export interface N8nConfig {
  baseUrl: string | null;
  apiKey: string | null;
  webhookBaseUrl: string | null;
}

const getSettingMap = async (keys: string[]) => {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: keys } },
  });

  return rows.reduce<Record<string, string | null>>((acc, row) => {
    acc[row.key] = row.value?.trim() ?? null;
    return acc;
  }, {});
};

const deriveWebhookBaseUrl = (baseUrl: string | null, override: string | null) => {
  const target = override ?? baseUrl;
  if (!target) {
    return null;
  }
  return target.replace(/\/api\/v1\/?$/, '');
};

export const getN8nConfig = async (): Promise<N8nConfig> => {
  const map = await getSettingMap(Object.values(SETTING_KEYS));

  const storedBase = map[SETTING_KEYS.n8nBaseUrl];
  const storedApiKey = map[SETTING_KEYS.n8nApiKey];
  const storedWebhook = map[SETTING_KEYS.n8nWebhookBaseUrl];

  const baseUrl = storedBase ?? env.n8nBaseUrl?.trim() ?? null;
  const apiKey = storedApiKey ?? env.n8nApiKey ?? null;
  const webhookBaseUrl =
    storedWebhook ??
    env.n8nWebhookBaseUrl?.trim() ??
    deriveWebhookBaseUrl(baseUrl, null);

  return {
    baseUrl,
    apiKey,
    webhookBaseUrl,
  };
};

interface UpdateN8nConfigInput {
  baseUrl?: string;
  apiKey?: string | null;
  webhookBaseUrl?: string | null;
}

const upsertSetting = async (key: string, value: string | null | undefined) => {
  if (value === undefined) {
    return;
  }

  if (value === null || value === '') {
    await prisma.appSetting
      .delete({
        where: { key },
      })
      .catch(() => undefined);
    return;
  }

  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
};

export const updateN8nConfig = async (input: UpdateN8nConfigInput): Promise<N8nConfig> => {
  const baseUrl = input.baseUrl ? input.baseUrl.trim() : undefined;
  const apiKey = input.apiKey === undefined ? undefined : input.apiKey?.trim() ?? null;
  const webhookBaseUrl =
    input.webhookBaseUrl === undefined ? undefined : input.webhookBaseUrl?.trim() ?? null;

  if (!baseUrl) {
    throw new Error('n8n base URL is required');
  }

  await upsertSetting(SETTING_KEYS.n8nBaseUrl, baseUrl);
  await upsertSetting(SETTING_KEYS.n8nApiKey, apiKey);
  await upsertSetting(SETTING_KEYS.n8nWebhookBaseUrl, webhookBaseUrl);

  return getN8nConfig();
};
