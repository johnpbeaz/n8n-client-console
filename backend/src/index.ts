import { createApp } from './app';
import { env } from './config/env';
import { connectPrisma, disconnectPrisma } from './lib/prisma';

const app = createApp();

const start = async () => {
  try {
    await connectPrisma();

    const server = app.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`API server listening on port ${env.port}`);
    });

    const shutdown = async () => {
      // eslint-disable-next-line no-console
      console.log('Shutting down gracefully...');
      server.close(async () => {
        await disconnectPrisma();
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server', error);
    process.exit(1);
  }
};

void start();

