/**
 * Creates one demo sign-in per system role (local development only).
 *
 *   npm run seed:demo                          create missing demo accounts
 *   npm run seed:demo -- --reset-passwords     new random passwords for all demo accounts
 *
 * Credentials are written to backend/demo-accounts.local.md (git-ignored), never printed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { c, connectOrExit, disconnect, loadEnvOrExit } from './cli.js';

const SHEET = resolve(process.cwd(), 'demo-accounts.local.md');

async function run(): Promise<number> {
  const env = await loadEnvOrExit();
  if (env.NODE_ENV === 'production') {
    console.error(c.fail('✖ seed:demo is for development only and never runs with NODE_ENV=production.'));
    return 1;
  }
  await connectOrExit(env);
  const { seedDemoUsers, parseSheet, renderSheet } = await import('../database/demo-seed.js');

  const outcomes = await seedDemoUsers({ resetPasswords: process.argv.includes('--reset-passwords') });
  const known = existsSync(SHEET) ? parseSheet(readFileSync(SHEET, 'utf8')) : new Map<string, string>();
  writeFileSync(SHEET, renderSheet(outcomes, known, env.APP_URL), { mode: 0o600 });

  console.info('');
  for (const o of outcomes) {
    const label =
      o.status === 'created'
        ? c.ok('created')
        : o.status === 'password-reset'
          ? c.warn('password reset')
          : c.dim('already exists (unchanged)');
    console.info(`  ${o.account.role.padEnd(20)} ${o.account.email.padEnd(42)} ${label}`);
  }
  const unknown = outcomes.filter((o) => !o.password && !known.has(o.account.email)).length;
  console.info('');
  console.info(
    c.ok(`✔ Demo accounts ready. Emails, passwords and role details: backend/demo-accounts.local.md`),
  );
  if (unknown)
    console.info(c.warn(`⚠ ${unknown} password(s) unknown — run: npm run seed:demo -- --reset-passwords`));
  return 0;
}

run()
  .then(async (code) => {
    await disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(c.fail(`✖ ${(err as Error).message}`));
    await disconnect();
    process.exit(1);
  });
