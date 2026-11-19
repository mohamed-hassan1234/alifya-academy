import mongoose from 'mongoose';
import { logger } from '../config/logger.js';

mongoose.set('strictQuery', true);
// Operator-injection defence: every request input is parsed by strict zod schemas (objects such as
// {"$ne": ...} are rejected) before reaching a query, so mongoose sanitizeFilter is not needed.

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true });
  logger.info({ db: conn.connection.name }, 'MongoDB connected');
  return conn;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
