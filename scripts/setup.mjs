#!/usr/bin/env node
/**
 * npm run setup — prepares a fresh clone for local development. Safe to run repeatedly.
 *
 *   1. checks Node.js / npm versions against package.json "engines"
 *   2. installs dependencies if any workspace is missing them (npm workspaces)
 *   3. creates backend/.env and frontend/.env from their .env.example templates if they don't exist
 *      (a new backend/.env gets a freshly generated JWT_ACCESS_SECRET) — existing files are NEVER modified
 *   4. validates backend/.env with the API's own schema and checks MongoDB connectivity
 *   5. prints what is left to do
 *
 * Flags:  --skip-install   don't run npm install
 *         --strict         exit non-zero unless the database is reachable too (used by `npm run bootstrap`)
 *
 * Uses only Node.js built-ins so it can run before `npm install`.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');

const color = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = color(32);
const red = color(31);
const yellow = color(33);
const dim = color(2);
const bold = color(1);

const problems = [];
const todo = [];
const step = (n, title) => console.info(`\n${bold(`[${n}/5] ${title}`)}`);
const ok = (msg) => console.info(green(`  ✔ ${msg}`));
const warn = (msg) => console.info(yellow(`  ⚠ ${msg}`));
const fail = (msg) => {
  console.info(red(`  ✖ ${msg}`));
  problems.push(msg);
};
const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');

/** Runs a command through the shell (needed for npm on Windows) with inherited output. */
function sh(command, opts = {}) {
  return spawnSync(command, { cwd: ROOT, stdio: 'inherit', shell: true, ...opts }).status ?? 1;
}

/* ------------------------------------------------------------------------------------------------ */
step(1, 'Checking Node.js and npm');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const parseVer = (v) =>
  v
    .replace(/^[^\d]*/, '')
    .split('.')
    .map(Number);
const atLeast = (have, need) => {
  for (let i = 0; i < 3; i++) {
    if ((have[i] ?? 0) !== (need[i] ?? 0)) return (have[i] ?? 0) > (need[i] ?? 0);
  }
  return true;
};
const nodeNeed = pkg.engines?.node ?? '>=20.11';
if (atLeast(parseVer(process.versions.node), parseVer(nodeNeed)))
  ok(`Node.js ${process.versions.node} (${nodeNeed})`);
else fail(`Node.js ${process.versions.node} is too old — ${nodeNeed} required (https://nodejs.org)`);

const npmVersion =
  /npm\/([\d.]+)/.exec(process.env.npm_config_user_agent ?? '')?.[1] ??
  spawnSync('npm -v', { shell: true, encoding: 'utf8' }).stdout?.trim();
const npmNeed = pkg.engines?.npm ?? '>=10';
if (!npmVersion) fail('npm not found on PATH');
else if (atLeast(parseVer(npmVersion), parseVer(npmNeed))) ok(`npm ${npmVersion} (${npmNeed})`);
else fail(`npm ${npmVersion} is too old — ${npmNeed} required (npm install -g npm@latest)`);
if (problems.length) finish();

/* ------------------------------------------------------------------------------------------------ */
step(2, 'Checking dependencies');
/** Packages each workspace must be able to resolve; if any is missing we (re)install. */
const required = {
  '.': ['concurrently', 'typescript', 'eslint'],
  backend: ['express', 'mongoose', 'tsx', 'tsup', '@alifya/shared'],
  frontend: ['vite', 'react', 'react-dom', '@alifya/shared', '@alifya/design-tokens'],
};
// Checked on disk (workspace-local node_modules, then the hoisted root one) rather than with
// require.resolve, because packages with an "exports" map may not expose package.json.
const isInstalled = (ws, name) =>
  [join(ROOT, ws), ROOT].some((dir) => existsSync(join(dir, 'node_modules', name, 'package.json')));
const missingDeps = () =>
  Object.entries(required).flatMap(([ws, names]) =>
    names.filter((n) => !isInstalled(ws, n)).map((n) => `${ws === '.' ? 'root' : ws}: ${n}`),
  );
let missing = missingDeps();
if (missing.length === 0) ok('All workspaces have their dependencies installed');
else if (args.has('--skip-install')) fail(`Missing dependencies (${missing.join(', ')}) — run: npm install`);
else {
  warn(`Missing: ${missing.join(', ')} — running npm install …`);
  if (sh('npm install') !== 0) fail('npm install failed — see the output above');
  missing = missingDeps();
  if (missing.length) fail(`Still missing after install: ${missing.join(', ')}`);
  else ok('Dependencies installed');
}
if (problems.length) finish();

/* ------------------------------------------------------------------------------------------------ */
step(3, 'Preparing environment files');
function ensureEnv(dir, transform = (s) => s) {
  const target = join(ROOT, dir, '.env');
  const template = join(ROOT, dir, '.env.example');
  if (existsSync(target)) return (ok(`${rel(target)} exists — left untouched`), false);
  if (!existsSync(template)) return (fail(`${rel(template)} is missing`), false);
  writeFileSync(target, transform(readFileSync(template, 'utf8')), { flag: 'wx' });
  ok(`Created ${rel(target)} from ${rel(template)}`);
  return true;
}
const createdBackend = ensureEnv('backend', (text) =>
  text.replace(/^JWT_ACCESS_SECRET=\s*$/m, `JWT_ACCESS_SECRET=${randomBytes(48).toString('base64url')}`),
);
if (createdBackend) ok('Generated a random JWT_ACCESS_SECRET (64 characters) in backend/.env');
ensureEnv('frontend');

/** Minimal .env reader for cross-file consistency hints (the backend schema does the real validation). */
function readEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((l) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(l))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/^(['"])(.*)\1$/, '$2')]),
  );
}
const be = { ...readEnv(join(ROOT, 'backend/.env')), ...pickProcessEnv(['PORT', 'WEB_ORIGINS']) };
const fe = readEnv(join(ROOT, 'frontend/.env'));
function pickProcessEnv(keys) {
  return Object.fromEntries(keys.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
}
const apiPort = be.PORT || '4000';
const feApiPort = process.env.API_PORT || fe.API_PORT || '4000';
const webPort = process.env.WEB_PORT || fe.WEB_PORT || '5173';
if (!fe.API_PROXY_TARGET && apiPort !== feApiPort)
  warn(`backend PORT=${apiPort} but frontend API_PORT=${feApiPort} — the dev proxy will not reach the API`);
const origins = (be.WEB_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim());
if (!origins.includes(`http://localhost:${webPort}`))
  warn(`WEB_ORIGINS (${origins.join(', ')}) does not include http://localhost:${webPort}`);

/* ------------------------------------------------------------------------------------------------ */
step(4, 'Validating configuration and database');
// Same as `npm run check -w @alifya/api`, but run directly so its exit code (0/1/2/3) is preserved.
const tsxCli = createRequire(join(ROOT, 'backend/package.json')).resolve('tsx/cli');
const check =
  spawnSync(process.execPath, [tsxCli, '--env-file-if-exists=.env', 'src/scripts/check.ts'], {
    cwd: join(ROOT, 'backend'),
    stdio: 'inherit',
  }).status ?? 1;
let dbReady = false;
if (check === 0) dbReady = true;
else if (check === 1) fail('backend/.env is invalid — fix the values listed above');
else if (check === 2) {
  const msg = 'MongoDB is not reachable';
  if (strict) fail(msg);
  else warn(msg);
  todo.push(
    'Start MongoDB, e.g. run `npm run db:dev` in a separate terminal (or set MONGODB_URI to your replica set / Atlas)',
  );
} else if (check === 3) {
  fail('MongoDB must run as a replica set');
  todo.push('Restart mongod with --replSet rs0 and run rs.initiate(), use Atlas, or use `npm run db:dev`');
} else fail(`Configuration check failed (exit code ${check})`);

/* ------------------------------------------------------------------------------------------------ */
finish();

function finish() {
  step(5, 'Summary');
  if (problems.length) {
    console.info(red(`\n  Setup is NOT complete — ${problems.length} problem(s):`));
    for (const p of problems) console.info(red(`   • ${p}`));
    if (todo.length) for (const t of todo) console.info(`   → ${t}`);
    console.info(dim('\n  Fix the above and run `npm run setup` again.'));
    process.exit(1);
  }
  if (!dbReady) {
    console.info(yellow('\n  Setup finished, but the database is not ready yet. Remaining steps:'));
    for (const t of todo) console.info(`   → ${t}`);
    console.info('   → then: npm run seed  &&  npm run seed:verify  &&  npm run dev');
    console.info(dim('     (or run everything at once with `npm run bootstrap`)'));
    process.exit(0);
  }
  console.info(green('\n  ✔ Setup complete. Next steps:'));
  console.info('   → npm run seed           initialise permissions, roles and site settings');
  console.info('   → npm run seed:verify    confirm the seeded data');
  console.info('   → npm run admin:create   create the first Super Administrator (if you have none)');
  console.info(
    `   → npm run dev            web: http://localhost:${webPort}   api: http://localhost:${apiPort}/api/v1`,
  );
  process.exit(0);
}
