#!/usr/bin/env node
/**
 * npm run bootstrap — complete, safe first-time initialisation for a developer machine:
 *
 *   1. refuses to run against NODE_ENV=production (seed production deliberately, see README)
 *   2. npm run setup --strict   prerequisites, dependencies, .env files, config validation, DB reachability
 *   3. migrations               none needed: the only data migration (RBAC catalogue sync) runs inside the seed
 *   4. npm run seed             idempotent system-data seed
 *   5. npm run seed:verify      read-only verification
 *
 * Stops at the first failing step with an explanation. Idempotent: running it again changes nothing that
 * is already in place (existing .env files, users, passwords and data are never modified or deleted).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const color = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = color(32);
const red = color(31);
const bold = color(1);
const dim = color(2);

function run(title, command) {
  console.info(`\n${bold(`▶ ${title}`)} ${dim(`(${command})`)}`);
  const status = spawnSync(command, { cwd: ROOT, stdio: 'inherit', shell: true }).status ?? 1;
  if (status !== 0) {
    console.error(
      red(`\n✖ Bootstrap stopped: "${title}" failed (exit code ${status}). Fix the issue above and re-run.`),
    );
    process.exit(status);
  }
}

// 1. Environment guard — read NODE_ENV the same way the backend will (shell first, then backend/.env).
const envFile = join(ROOT, 'backend/.env');
const fileNodeEnv = existsSync(envFile)
  ? /^\s*NODE_ENV\s*=\s*["']?([^"'\s#]+)/m.exec(readFileSync(envFile, 'utf8'))?.[1]
  : undefined;
const nodeEnv = process.env.NODE_ENV || fileNodeEnv || 'development';
if (nodeEnv === 'production') {
  console.error(red('✖ NODE_ENV=production — bootstrap only initialises development/test environments.'));
  console.error('  For production run the steps deliberately: npm run build, then');
  console.error(
    '  npm run seed:prod -w @alifya/api -- --confirm-production  and  npm run seed:verify:prod -w @alifya/api',
  );
  process.exit(1);
}
console.info(bold(`Bootstrapping Alifya Academy (NODE_ENV=${nodeEnv})`));

run('Setup: prerequisites, dependencies, environment, database', 'node scripts/setup.mjs --strict');
console.info(
  `\n${bold('▶ Migrations')} ${dim('— no separate migrations required; the RBAC catalogue migration runs in the seed')}`,
);
run('Seed system data', 'npm run --silent seed');
run('Verify seeded data', 'npm run --silent seed:verify');

console.info(green('\n✔ Bootstrap complete.'));
console.info('  → npm run admin:create   create the first Super Administrator (skip if one exists)');
console.info('  → npm run dev            start the API and the web app');
