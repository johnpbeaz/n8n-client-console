import axios from 'axios';

import { env } from '../config/env';

const hasMailgunConfig =
  Boolean(env.mailgunApiKey) && Boolean(env.mailgunDomain) && Boolean(env.mailgunFromEmail);

export const canSendClientEmails = () => hasMailgunConfig;

interface PasswordEmailPayload {
  to: string;
  clientName: string;
  setupUrl: string;
  expiresAt: Date;
  mode: 'setup' | 'reset';
}

const buildEmailContent = ({ clientName, setupUrl, expiresAt, mode }: PasswordEmailPayload) => {
  const subject =
    mode === 'reset' ? 'Reset your Catalyst password' : 'Set up your Catalyst access';

  const intro =
    mode === 'reset'
      ? 'You requested a new password for Catalyst.'
      : 'You have been invited to Catalyst.';

  const actionLine =
    mode === 'reset'
      ? 'Use the link below to create a new password:'
      : 'Use the link below to create your password and finish setting up access:';

  const expiryLine = `This link expires on ${expiresAt.toLocaleString()}.`;

  const textBody = [
    `Hi ${clientName},`,
    '',
    intro,
    '',
    actionLine,
    setupUrl,
    '',
    expiryLine,
    '',
    'If you did not expect this message, you can ignore it.',
    '',
    'Catalyst',
  ].join('\n');

  const htmlBody = [
    `<p>Hi ${clientName},</p>`,
    `<p>${intro}</p>`,
    `<p>${actionLine}</p>`,
    `<p><a href="${setupUrl}" style="color:#1d4ed8">Set your password</a></p>`,
    `<p>${expiryLine}</p>`,
    '<p>If you did not expect this message, you can ignore it.</p>',
    '<p>Catalyst</p>',
  ].join('');

  return { subject, textBody, htmlBody };
};

export const sendPasswordEmail = async (payload: PasswordEmailPayload) => {
  if (!hasMailgunConfig) {
    throw new Error('Mailgun configuration is incomplete');
  }

  const { subject, textBody, htmlBody } = buildEmailContent(payload);

  const endpoint = `${env.mailgunBaseUrl}/v3/${env.mailgunDomain}/messages`;
  const params = new URLSearchParams();

  params.append('from', env.mailgunFromEmail as string);
  params.append('to', payload.to);
  params.append('subject', subject);
  params.append('text', textBody);
  params.append('html', htmlBody);

  await axios.post(endpoint, params, {
    auth: {
      username: 'api',
      password: env.mailgunApiKey as string,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10_000,
  });
};
