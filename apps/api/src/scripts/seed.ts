/**
 * Seeds RBAC (permissions + system roles) and, if SEED_SUPERADMIN_EMAIL/PASSWORD are set, creates or
 * promotes the first Super Administrator. Creates NO sample courses, users or statistics.
 *
 *   npm run seed
 */
import { passwordSchema } from '@alifya/shared';
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { hashPassword } from '../modules/auth/auth.service.js';
import { Role } from '../modules/roles/role.model.js';
import { seedRbac } from '../modules/roles/roles.service.js';
import { User } from '../modules/users/user.model.js';

async function run() {
  await connectDatabase(env.MONGODB_URI);
  await seedRbac();
  console.info('✔ Permissions and system roles synced');

  const email = env.SEED_SUPERADMIN_EMAIL?.toLowerCase();
  const password = env.SEED_SUPERADMIN_PASSWORD;
  if (email && password) {
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) throw new Error(`SEED_SUPERADMIN_PASSWORD: ${pw.error.issues[0]?.message}`);
    const superRole = await Role.findOne({ key: 'super_admin' }).lean();
    if (!superRole) throw new Error('super_admin role missing');
    const existing = await User.findOne({ email }).select('_id').lean();
    if (existing) {
      await User.updateOne({ _id: existing._id }, { $addToSet: { roles: superRole._id } });
      console.info(`✔ Existing user ${email} granted Super Administrator (password unchanged)`);
    } else {
      await User.create({
        fullName: env.SEED_SUPERADMIN_NAME,
        email,
        passwordHash: await hashPassword(password),
        roles: [superRole._id],
        status: 'active',
        emailVerifiedAt: new Date(),
      });
      console.info(`✔ Super Administrator ${email} created`);
    }
  } else {
    console.info('ℹ SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD not set — no administrator created');
  }
  await disconnectDatabase();
}

run().catch(async (err) => {
  console.error(err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
