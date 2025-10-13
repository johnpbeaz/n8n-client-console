import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, isProduction } from './config/env';
import routes from './routes';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  const allowedOrigins =
    env.corsOrigin && env.corsOrigin.trim().length > 0
      ? env.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean)
      : undefined;

  app.use(
    cors({
      origin: env.nodeEnv === 'development' ? '*' : allowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    morgan(isProduction ? 'combined' : 'dev', {
      skip: () => env.nodeEnv === 'test',
    }),
  );

  app.use('/api', routes);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Log for observability
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
};
