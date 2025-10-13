import { config as loadEnv } from 'dotenv';

loadEnv();

const numberOrDefault = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const required = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: numberOrDefault(process.env.PORT, 4000),
  jwtSecret: required(process.env.JWT_SECRET, 'JWT_SECRET'),
  jwtExpiry: process.env.JWT_EXPIRY ?? '12h',
  databaseUrl: required(process.env.DATABASE_URL, 'DATABASE_URL'),
  n8nBaseUrl: process.env.N8N_BASE_URL,
  n8nApiKey: process.env.N8N_API_KEY,
  corsOrigin: process.env.CORS_ORIGIN ?? '',
  mailgunApiKey: process.env.MAILGUN_API_KEY,
  mailgunDomain: process.env.MAILGUN_DOMAIN,
  mailgunFromEmail: process.env.MAILGUN_FROM_EMAIL,
  mailgunBaseUrl: process.env.MAILGUN_BASE_URL ?? 'https://api.mailgun.net',
  n8nWebhookBaseUrl: process.env.N8N_WEBHOOK_BASE_URL,
  appBaseUrl: required(process.env.APP_BASE_URL, 'APP_BASE_URL'),
};

export const isProduction = env.nodeEnv === 'production';
