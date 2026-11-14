import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import { emailSender, type MemoryEmailSender } from '../integrations/email/index.js';
import { seedRbac } from '../modules/roles/roles.service.js';

const KEEP = new Set(['roles', 'permissions']);

beforeAll(async () => {
  const uri = inject('mongoUri');
  const dbName = `test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  await mongoose.connect(uri, { dbName });
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
  await seedRbac();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.filter((c) => !KEEP.has(c.collectionName)).map((c) => c.deleteMany({})));
  (emailSender as MemoryEmailSender).clear();
  await seedRbac(); // restore system roles if a test changed them
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
});
