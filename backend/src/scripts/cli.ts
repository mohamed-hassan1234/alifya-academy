/** Small helpers shared by the command-line scripts (seed, seed:verify, admin:create). */
import type { Env } from '../config/env.js';

export const c = {
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  fail: (s: string) => `\x1b[31m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

/** Hides credentials in a connection string before it is printed. */
export function redactUri(uri: string): string {
  return uri.replace(/\/\/([^@/]+)@/, '//***:***@');
}

/** Loads and validates backend/.env (via src/config/env.ts); prints a friendly message and exits on error. */
export async function loadEnvOrExit(): Promise<Env> {
  try {
    return (await import('../config/env.js')).env;
  } catch (err) {
    console.error(c.fail(`✖ ${(err as Error).message}`));
    console.error(
      `  Fix backend/.env (template: backend/.env.example). ${c.dim('Tip: `npm run setup` creates it for you.')}`,
    );
    process.exit(1);
  }
}

/**
 * Refuses to touch a production database unless the operator passes --confirm-production explicitly.
 */
export function guardProduction(env: Env, action: string): void {
  if (env.NODE_ENV !== 'production') return;
  if (process.argv.includes('--confirm-production')) {
    console.warn(c.warn(`⚠ NODE_ENV=production — ${action} confirmed with --confirm-production`));
    return;
  }
  console.error(c.fail(`✖ NODE_ENV=production: refusing to ${action} without explicit confirmation.`));
  console.error('  Re-run with --confirm-production, e.g.  npm run seed -- --confirm-production');
  process.exit(1);
}

/** Closes the database connection if one was opened (safe to call at any time). */
export async function disconnect(): Promise<void> {
  const mongoose = (await import('mongoose')).default;
  await mongoose.disconnect().catch(() => undefined);
}

export async function connectOrExit(env: Env): Promise<void> {
  const { connectDatabase } = await import('../database/connection.js');
  try {
    await connectDatabase(env.MONGODB_URI);
  } catch (err) {
    console.error(c.fail(`✖ Cannot connect to MongoDB at ${redactUri(env.MONGODB_URI)}`));
    console.error(`  ${(err as Error).message}`);
    console.error(
      '  Start a database first — e.g. `npm run db:dev` in another terminal — or fix MONGODB_URI in backend/.env.',
    );
    process.exit(1);
  }
}
