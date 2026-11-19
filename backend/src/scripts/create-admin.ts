/**
 * Interactive, secure bootstrap of a Super Administrator.
 *
 *   npm run admin:create
 *
 * - The password is typed with hidden input, confirmed, validated against the app's password policy and
 *   hashed with the same bcrypt routine as registration. It is never printed or logged.
 * - If the email already belongs to an account, that account is granted Super Administrator and its
 *   password is NOT changed (no password is asked for).
 * - Non-interactive alternative (CI / provisioning): set SEED_SUPERADMIN_* in backend/.env and run `npm run seed`.
 */
import { createInterface } from 'node:readline/promises';
import { emailSchema, PASSWORD_MIN_LENGTH } from '@alifya/shared';
import { c, connectOrExit, disconnect, guardProduction, loadEnvOrExit } from './cli.js';

function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write('\n');
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          cleanup();
          return resolve(value);
        }
        if (ch === '\u0003') {
          cleanup();
          return reject(new Error('Cancelled'));
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function run(): Promise<number> {
  if (!process.stdin.isTTY) {
    console.error(
      c.fail('✖ admin:create needs an interactive terminal (the password is typed with hidden input).'),
    );
    console.error(
      '  For automated setups set SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD and run `npm run seed`.',
    );
    return 1;
  }
  const env = await loadEnvOrExit();
  guardProduction(env, 'create an administrator');
  await connectOrExit(env);
  const { ensureSuperAdmin } = await import('../database/seed.js');
  const { User } = await import('../modules/users/user.model.js');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const emailRaw = await rl.question('Administrator email: ');
  const parsedEmail = emailSchema.safeParse(emailRaw);
  if (!parsedEmail.success) {
    rl.close();
    console.error(c.fail(`✖ ${parsedEmail.error.issues[0]?.message}`));
    return 1;
  }
  const email = parsedEmail.data;

  if (await User.exists({ email })) {
    rl.close();
    const outcome = await ensureSuperAdmin({ email, password: '', fullName: '' });
    console.info(
      outcome === 'promoted'
        ? c.ok(`✔ Existing account ${email} granted Super Administrator (password unchanged)`)
        : c.ok(`✔ ${email} is already a Super Administrator (nothing changed)`),
    );
    return 0;
  }

  const fullName = (await rl.question('Full name [Super Administrator]: ')).trim() || 'Super Administrator';
  rl.close();
  console.info(c.dim(`Password: at least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number.`));
  const password = await askHidden('Password (hidden): ');
  const confirm = await askHidden('Confirm password: ');
  if (password !== confirm) {
    console.error(c.fail('✖ Passwords do not match — nothing was created.'));
    return 1;
  }
  await ensureSuperAdmin({ email, password, fullName });
  console.info(c.ok(`✔ Super Administrator ${email} created. Sign in at ${env.APP_URL}/login`));
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
