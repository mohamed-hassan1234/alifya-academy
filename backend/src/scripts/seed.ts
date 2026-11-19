/**
 * Seeds the system data the application needs (permissions, system roles, site settings) and — only if
 * SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD are set — the first Super Administrator.
 * Idempotent and non-destructive: safe to run any number of times. Creates NO sample courses or users.
 *
 *   npm run seed                              (from the repository root)
 *   npm run seed -- --confirm-production      (required when NODE_ENV=production)
 */
import { c, connectOrExit, disconnect, guardProduction, loadEnvOrExit, redactUri } from './cli.js';

async function run(): Promise<number> {
  const env = await loadEnvOrExit();
  guardProduction(env, 'seed the database');
  console.info(c.bold(`Seeding ${redactUri(env.MONGODB_URI)} (NODE_ENV=${env.NODE_ENV})`));
  await connectOrExit(env);
  // Loaded after env validation so configuration errors are reported cleanly.
  const { seedSystemData } = await import('../database/seed.js');

  const email = env.SEED_SUPERADMIN_EMAIL?.trim();
  const password = env.SEED_SUPERADMIN_PASSWORD;
  if (email && !password)
    console.warn(c.warn('⚠ SEED_SUPERADMIN_EMAIL is set but SEED_SUPERADMIN_PASSWORD is empty'));

  const steps = await seedSystemData({
    admin: email && password ? { email, password, fullName: env.SEED_SUPERADMIN_NAME } : null,
  });

  console.info('');
  console.info(c.bold('Step                         Inserted  Updated  Unchanged  Removed  Result'));
  for (const s of steps) {
    const n = s.counts;
    const cols = n
      ? [n.inserted, n.updated, n.unchanged, n.removed].map((v, i) => String(v).padStart([8, 9, 11, 9][i]!))
      : ['', '', '', ''].map((v, i) => v.padStart([8, 9, 11, 9][i]!));
    const result =
      s.status === 'ok' ? c.ok('✔ ok') : s.status === 'skipped' ? c.warn('– skipped') : c.fail('✖ FAILED');
    console.info(`${s.name.padEnd(28)}${cols.join('')}  ${result}${s.detail ? c.dim(`  ${s.detail}`) : ''}`);
  }
  const failed = steps.filter((s) => s.status === 'failed').length;
  console.info('');
  if (failed) console.error(c.fail(`✖ Seeding finished with ${failed} failed step(s).`));
  else console.info(c.ok('✔ Seeding complete. Verify with: npm run seed:verify'));
  return failed ? 1 : 0;
}

run()
  .then(async (code) => {
    await disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(c.fail(`✖ Seeding aborted: ${(err as Error).message}`));
    await disconnect();
    process.exit(1);
  });
