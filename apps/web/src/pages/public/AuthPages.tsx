import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import {
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@alifya/shared';
import { FormField } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { AlertMessage } from '@/components/ui/feedback';
import { Checkbox, Input } from '@/components/ui/form-controls';
import { AuthCard, applyServerErrors } from '@/features/auth/AuthCard';
import { dashboardPathFor, useAuth } from '@/features/auth/AuthProvider';
import { apiPost, normalizeError, type NormalizedError } from '@/lib/api';
import { usePageMeta } from '@/lib/seo';

/* ------------------------------ Login ------------------------------ */
export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [error, setError] = useState<NormalizedError | null>(null);
  const [resent, setResent] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  usePageMeta({ title: t('auth.loginTitle'), noindex: true });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const user = await login(values);
      navigate(from && from.startsWith('/') ? from : dashboardPathFor(user), { replace: true });
    } catch (err) {
      setError(applyServerErrors(err, form.setError));
    }
  });

  const resend = async () => {
    await apiPost('/auth/resend-verification', { email: form.getValues('email') }).catch(() => undefined);
    setResent(true);
  };

  return (
    <AuthCard
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            {t('auth.createOne')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {from && !error && <AlertMessage tone="info">{t('auth.sessionExpired')}</AlertMessage>}
        {error && (
          <AlertMessage tone="danger" title={error.message}>
            {error.code === 'ACCOUNT_NOT_VERIFIED' &&
              (resent ? (
                t('auth.resent')
              ) : (
                <button type="button" onClick={resend} className="font-semibold text-primary underline">
                  {t('auth.resend')}
                </button>
              ))}
          </AlertMessage>
        )}
        <FormField label={t('auth.email')} error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
        </FormField>
        <FormField label={t('auth.password')} error={form.formState.errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...form.register('password')} />
        </FormField>
        <Link
          to="/forgot-password"
          className="-mt-2 self-end text-sm font-semibold text-primary hover:underline"
        >
          {t('auth.forgot')}
        </Link>
        <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>
    </AuthCard>
  );
}

/* ------------------------------ Register ------------------------------ */
export function RegisterPage() {
  const { t } = useTranslation();
  const [error, setError] = useState<NormalizedError | null>(null);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false as unknown as true,
    },
  });
  usePageMeta({ title: t('auth.registerTitle'), noindex: true });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await apiPost('/auth/register', values);
      setDoneEmail(values.email);
    } catch (err) {
      setError(applyServerErrors(err, form.setError));
    }
  });

  if (doneEmail) {
    return (
      <AuthCard title={t('auth.registeredTitle')}>
        <AlertMessage tone="success">{t('auth.registeredBody', { email: doneEmail })}</AlertMessage>
        <Button asChild className="mt-6 w-full">
          <Link to="/login">{t('auth.signIn')}</Link>
        </Button>
      </AuthCard>
    );
  }

  const e = form.formState.errors;
  return (
    <AuthCard
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      footer={
        <>
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            {t('auth.signIn')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {error && <AlertMessage tone="danger">{error.message}</AlertMessage>}
        <FormField label={t('auth.fullName')} error={e.fullName?.message}>
          <Input autoComplete="name" {...form.register('fullName')} />
        </FormField>
        <FormField label={t('auth.email')} error={e.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
        </FormField>
        <FormField label={t('auth.phone')} error={e.phone?.message}>
          <Input type="tel" autoComplete="tel" inputMode="tel" {...form.register('phone')} />
        </FormField>
        <FormField label={t('auth.password')} hint={t('auth.passwordHint')} error={e.password?.message}>
          <Input type="password" autoComplete="new-password" {...form.register('password')} />
        </FormField>
        <FormField label={t('auth.confirmPassword')} error={e.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
        </FormField>
        <div>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox {...form.register('acceptTerms')} aria-invalid={e.acceptTerms ? true : undefined} />
            <span>{t('auth.acceptTerms')}</span>
          </label>
          {e.acceptTerms && <p className="mt-1.5 text-xs font-medium text-danger">{e.acceptTerms.message}</p>}
        </div>
        <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('auth.creating') : t('auth.createAccount')}
        </Button>
      </form>
    </AuthCard>
  );
}

/* ------------------------------ Forgot password ------------------------------ */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ email: string }>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: '' },
  });
  usePageMeta({ title: t('auth.forgotTitle'), noindex: true });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await apiPost('/auth/forgot-password', values);
      setDone(true);
    } catch (err) {
      setError(normalizeError(err).message);
    }
  });

  return (
    <AuthCard
      title={t('auth.forgotTitle')}
      subtitle={done ? undefined : t('auth.forgotSubtitle')}
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          {t('auth.backToLogin')}
        </Link>
      }
    >
      {done ? (
        <AlertMessage tone="success">{t('auth.forgotDone')}</AlertMessage>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {error && <AlertMessage tone="danger">{error}</AlertMessage>}
          <FormField label={t('auth.email')} error={form.formState.errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
          </FormField>
          <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t('auth.sending') : t('auth.sendLink')}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

/* ------------------------------ Reset password ------------------------------ */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });
  usePageMeta({ title: t('auth.resetTitle'), noindex: true });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await apiPost('/auth/reset-password', values);
      setDone(true);
    } catch (err) {
      setError(applyServerErrors(err, form.setError).message);
    }
  });

  return (
    <AuthCard title={t('auth.resetTitle')}>
      {!token ? (
        <AlertMessage tone="danger">{t('auth.missingToken')}</AlertMessage>
      ) : done ? (
        <>
          <AlertMessage tone="success">{t('auth.resetDone')}</AlertMessage>
          <Button asChild className="mt-6 w-full">
            <Link to="/login">{t('auth.signIn')}</Link>
          </Button>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {error && <AlertMessage tone="danger">{error}</AlertMessage>}
          <FormField
            label={t('auth.newPassword')}
            hint={t('auth.passwordHint')}
            error={form.formState.errors.password?.message}
          >
            <Input type="password" autoComplete="new-password" {...form.register('password')} />
          </FormField>
          <FormField label={t('auth.confirmPassword')} error={form.formState.errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
          </FormField>
          <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
            {t('auth.resetSubmit')}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

/* ------------------------------ Verify email ------------------------------ */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const verify = useMutation({ mutationFn: (tk: string) => apiPost('/auth/verify-email', { token: tk }) });
  const fired = useRef(false);
  usePageMeta({ title: t('auth.verifyTitle'), noindex: true });

  useEffect(() => {
    // Tokens are single-use: guard against React StrictMode's double effect invocation.
    if (token && !fired.current) {
      fired.current = true;
      verify.mutate(token);
    }
  }, [token, verify]);

  return (
    <AuthCard title={t('auth.verifyTitle')}>
      {!token ? (
        <AlertMessage tone="danger">{t('auth.missingToken')}</AlertMessage>
      ) : verify.isPending || verify.isIdle ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : verify.isError ? (
        <AlertMessage tone="danger">{normalizeError(verify.error).message}</AlertMessage>
      ) : (
        <>
          <AlertMessage tone="success">{t('auth.verifyDone')}</AlertMessage>
          <Button asChild className="mt-6 w-full">
            <Link to="/login">{t('auth.signIn')}</Link>
          </Button>
        </>
      )}
    </AuthCard>
  );
}
