import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { ensureStorageReady } from './integrations/storage/index.js';
import { seedRbac } from './modules/roles/roles.service.js';

async function main() {
  await connectDatabase(env.MONGODB_URI);
  await ensureStorageReady();
  await seedRbac(); // idempotent: keeps the permission catalogue and system roles in sync with code
  const server = createApp().listen(env.PORT, () =>
    logger.info(`API listening on http://localhost:${env.PORT}/api/v1`),
  );

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      disconnectDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start API');
  process.exit(1);
});
