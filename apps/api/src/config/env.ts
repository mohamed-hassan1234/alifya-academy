import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/alifya?replicaSet=rs0'),
    /** Comma-separated list of allowed browser origins. */
    WEB_ORIGINS: z.string().default('http://localhost:5173'),
    /** Public URL of the web app, used for links in emails. */
    APP_URL: z.string().url().default('http://localhost:5173'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
    COOKIE_SECURE: bool.optional(),
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    EMAIL_PROVIDER: z.enum(['console', 'smtp', 'memory']).default('console'),
    EMAIL_FROM: z.string().default('Alifya Academy <no-reply@localhost>'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: bool.optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    /** Root folder for uploaded files (local storage driver). */
    STORAGE_DIR: z.string().default('./storage'),
    STORAGE_DRIVER: z.enum(['local']).default('local'),
    SEED_SUPERADMIN_EMAIL: z.string().email().optional(),
    SEED_SUPERADMIN_PASSWORD: z.string().optional(),
    SEED_SUPERADMIN_NAME: z.string().default('Super Administrator'),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === 'production') {
      if (e.EMAIL_PROVIDER !== 'smtp') {
        ctx.addIssue({
          code: 'custom',
          path: ['EMAIL_PROVIDER'],
          message: 'Production requires EMAIL_PROVIDER=smtp',
        });
      }
      if (e.COOKIE_SECURE === false) {
        ctx.addIssue({
          code: 'custom',
          path: ['COOKIE_SECURE'],
          message: 'Secure cookies are mandatory in production',
        });
      }
    }
    if (e.EMAIL_PROVIDER === 'smtp' && !e.SMTP_HOST) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST is required for EMAIL_PROVIDER=smtp',
      });
    }
  });

export type Env = z.infer<typeof envSchema> & {
  webOrigins: string[];
  cookieSecure: boolean;
  isProd: boolean;
};

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  const e = parsed.data;
  return {
    ...e,
    webOrigins: e.WEB_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    cookieSecure: e.COOKIE_SECURE ?? e.NODE_ENV === 'production',
    isProd: e.NODE_ENV === 'production',
  };
}

export const env = loadEnv();
