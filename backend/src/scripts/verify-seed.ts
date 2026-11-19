/**
 * Read-only verification of the seeded system data (never writes to the database).
 *
 *   npm run seed:verify       exits 1 if any required check fails; warnings do not fail
 */
import { c, connectOrExit, disconnect, loadEnvOrExit, redactUri } from './cli.js';

async function run(): Promise<number> {
  const env = await loadEnvOrExit();
  console.info(c.bold(`Verifying ${redactUri(env.MONGODB_URI)}`));
  await connectOrExit(env);
  const { verifySeedData } = await import('../database/seed.js');
  const checks = await verifySeedData();
  console.info('');
  for (const ch of checks) {
    const mark = ch.level === 'pass' ? c.ok('✔') : ch.level === 'warn' ? c.warn('⚠') : c.fail('✖');
    console.info(`${mark} ${ch.name}${ch.detail ? c.dim(` — ${ch.detail}`) : ''}`);
  }
  const fails = checks.filter((x) => x.level === 'fail').length;
  const warns = checks.filter((x) => x.level === 'warn').length;
  const passes = checks.length - fails - warns;
  console.info('');
  const summary = `${passes} passed, ${fails} failed, ${warns} warning(s)`;
  if (fails) console.error(c.fail(`✖ Verification failed: ${summary}. Run \`npm run seed\` and try again.`));
  else console.info(c.ok(`✔ Verification passed: ${summary}`));
  return fails ? 1 : 0;
}

run()
  .then(async (code) => {
    await disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(c.fail(`✖ Verification aborted: ${(err as Error).message}`));
    await disconnect();
    process.exit(1);
  });
