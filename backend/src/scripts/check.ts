/**
 * Pre-flight check used by `npm run setup` / `npm run bootstrap` (also runnable on its own):
 * validates backend/.env with the same schema the API uses at startup, then checks MongoDB connectivity.
 *
 *   npm run check -w @alifya/api            exit 0 = ok, 1 = invalid config, 2 = DB unreachable,
 *                                           3 = DB reachable but not a replica set
 */
import { c, disconnect, loadEnvOrExit, redactUri } from './cli.js';

async function run(): Promise<number> {
  const env = await loadEnvOrExit(); // exits 1 with the list of problems if invalid
  console.info(c.ok('✔ backend/.env is valid'));
  console.info(
    c.dim(
      `  NODE_ENV=${env.NODE_ENV}  PORT=${env.PORT}  WEB_ORIGINS=${env.WEB_ORIGINS}  EMAIL_PROVIDER=${env.EMAIL_PROVIDER}`,
    ),
  );
  if (!env.SEED_SUPERADMIN_EMAIL)
    console.info(
      c.dim('  No SEED_SUPERADMIN_* set — create an administrator later with `npm run admin:create`.'),
    );

  const mongoose = (await import('mongoose')).default;
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5_000 });
  } catch (err) {
    console.error(c.fail(`✖ MongoDB not reachable at ${redactUri(env.MONGODB_URI)}`));
    console.error(c.dim(`  ${(err as Error).message.split('\n')[0]}`));
    return 2;
  }
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  const version = (await mongoose.connection.db!.admin().serverInfo()).version as string;
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    console.error(
      c.fail(`✖ MongoDB ${version} is reachable but is NOT a replica set (transactions need one).`),
    );
    return 3;
  }
  console.info(
    c.ok(`✔ MongoDB ${version} reachable (${hello.setName ? `replica set "${hello.setName}"` : 'mongos'})`),
  );
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
