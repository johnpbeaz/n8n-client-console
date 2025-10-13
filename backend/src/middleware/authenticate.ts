import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import type { AuthUser, UserRole } from '../types/user';

const parseToken = (authorizationHeader?: string): string | null => {
  if (!authorizationHeader) {
    return null;
  }
  const [scheme, token] = authorizationHeader.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

const verifyToken = (token: string): AuthUser | null => {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (
      typeof payload === 'object' &&
      payload !== null &&
      typeof payload.sub === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.role === 'string'
    ) {
      return {
        id: payload.sub,
        email: payload.email,
        role: payload.role as UserRole,
        name: typeof payload.name === 'string' ? payload.name : '',
        clientId: typeof payload.clientId === 'string' ? payload.clientId : null,
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const authenticate =
  (roles?: UserRole | UserRole[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const token = parseToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = verifyToken(token);

    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const allowedRoles = roles ? (Array.isArray(roles) ? roles : [roles]) : null;

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    req.user = user;
    next();
  };

