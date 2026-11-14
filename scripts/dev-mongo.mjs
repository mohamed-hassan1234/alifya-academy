/**
 * Local development MongoDB for machines without MongoDB/Docker installed.
 * Starts a single-node REPLICA SET (needed for transactions) on 127.0.0.1:27017 with data persisted in ./.data/mongo.
 *
 *   npm run db:dev        (leave running; Ctrl+C to stop)
 *
 * Not for production. Production must use a managed replica set (e.g. MongoDB Atlas) — see docs/DEPLOYMENT.md.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const dbPath = resolve(process.cwd(), '.data/mongo');
mkdirSync(dbPath, { recursive: true });

const replSet = await MongoMemoryReplSet.create({
  replSet: {
    name: 'rs0',
    count: 1,
    storageEngine: 'wiredTiger',
    configSettings: { electionTimeoutMillis: 500 },
  },
  instanceOpts: [{ port: 27017, dbPath }],
});

console.info(`MongoDB replica set ready: ${replSet.getUri('alifya')}`);
console.info('Press Ctrl+C to stop.');

const stop = async () => {
  await replSet.stop({ doCleanup: false, force: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
