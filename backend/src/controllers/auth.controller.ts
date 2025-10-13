import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';

import { PasswordTokenType } from '@prisma/client';

import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { consumePasswordToken } from '../services/password-token.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const passwordSetupSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const buildToken = (params: {
  id: string;
  email: string;
  role: string;
  name: string;
  clientId?: string | null;
}) => {
  const payload = {
    email: params.email,
    role: params.role,
    name: params.name,
    clientId: params.clientId,
  };

  const options: SignOptions = {
    subject: params.id,
  };

  if (env.jwtExpiry) {
    options.expiresIn = env.jwtExpiry as unknown as SignOptions['expiresIn'];
  }

  return jwt.sign(payload, env.jwtSecret as Secret, options);
};

export const login = async (req: Request, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid credentials payload', details: parseResult.error.flatten() });
    return;
  }

  const { email, password } = parseResult.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = buildToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    clientId: user.clientId,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      clientId: user.clientId,
      clientName: user.client?.name ?? null,
    },
  });
};

export const me = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId: user.clientId,
    clientName: user.client?.name ?? null,
  });
};

export const completePasswordSetup = async (req: Request, res: Response) => {
  const parseResult = passwordSetupSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten() });
    return;
  }

  const { token, password } = parseResult.data;

  const user = await consumePasswordToken(token, PasswordTokenType.setup);

  if (!user) {
    res.status(400).json({ error: 'This link is invalid or has expired.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  res.json({ success: true });
};
