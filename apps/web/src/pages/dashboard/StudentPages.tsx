import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookOpen, faHourglassHalf } from '@fortawesome/free-solid-svg-icons';
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type CurrentUser,
  type UpdateProfileInput,
} from '@alifya/shared';
import { DashboardPageHeader } from '@/components/layout/DashboardLayout';
import { FormField, StatusBadge } from '@/components/shared';
import { useToast } from '@/components/shared/toast';
import { Button } from '@/components/ui/button';
import { AlertMessage, Badge } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/form-controls';
import { applyServerErrors } from '@/features/auth/AuthCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { apiPatch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { usePageMeta } from '@/lib/seo';
import i18n from '@/i18n';
import { useState } from 'react';

export function StudentDashboardPage() {
  const { t, i18n: i } = useTranslation();
  const { user } = useAuth();
  usePageMeta({ title: t('nav.dashboard'), noindex: true });
  if (!user) return null;
  return (
    <>
      <DashboardPageHeader title={t('dashboard.welcome', { name: user.fullName.split(' ')[0] })} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-lg border border-border bg-background p-6 sm:p-8">
          <span className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-mint text-primary">
            <FontAwesomeIcon icon={faHourglassHalf} aria-hidden />
          </span>
          <h2 className="text-xl">{t('dashboard.upcomingModules')}</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {t('dashboard.upcomingBody')}
          </p>
          <Button asChild className="mt-6">
            <Link to="/courses">
              <FontAwesomeIcon icon={faBookOpen} aria-hidden /> {t('dashboard.browseCourses')}
            </Link>
          </Button>
        </section>
        <section className="rounded-lg border border-border bg-background p-6">
          <h2 className="text-lg">{t('dashboard.accountTitle')}</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('auth.email')}</dt>
              <dd className="mt-0.5 break-all font-semibold">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('admin.status')}</dt>
              <dd className="mt-1">
                <StatusBadge status={user.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('dashboard.roles')}</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {user.roles.map((r) => (
                  <Badge key={r.id}>{r.name}</Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('dashboard.memberSince')}</dt>
              <dd className="mt-0.5 font-semibold">{formatDate(user.createdAt, i.language)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  usePageMeta({ title: t('dashboard.profileTitle'), noindex: true });
  if (!user) return null;
  return (
    <>
      <DashboardPageHeader title={t('dashboard.profileTitle')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm user={user} onSaved={setUser} />
        <PasswordForm />
      </div>
    </>
  );
}

function ProfileForm({ user, onSaved }: { user: CurrentUser; onSaved: (u: CurrentUser) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullName: user.fullName,
      phone: user.phone ?? '',
      preferredLanguage: user.preferredLanguage,
    },
  });
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const updated = await apiPatch<CurrentUser>('/users/me', { ...v, phone: v.phone || null });
      onSaved(updated);
      if (updated.preferredLanguage !== i18n.language) void i18n.changeLanguage(updated.preferredLanguage);
      toast(t('dashboard.profileSaved'));
    } catch (err) {
      setError(applyServerErrors(err, form.setError).message);
    }
  });
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-lg border border-border bg-background p-6"
    >
      <h2 className="text-lg">{t('dashboard.profileTitle')}</h2>
      {error && <AlertMessage tone="danger">{error}</AlertMessage>}
      <FormField label={t('auth.fullName')} error={form.formState.errors.fullName?.message}>
        <Input autoComplete="name" {...form.register('fullName')} />
      </FormField>
      <FormField label={t('auth.email')}>
        <Input value={user.email} disabled readOnly />
      </FormField>
      <FormField label={t('auth.phone')} error={form.formState.errors.phone?.message}>
        <Input type="tel" autoComplete="tel" {...form.register('phone')} />
      </FormField>
      <FormField label={t('dashboard.preferredLanguage')}>
        <Select {...form.register('preferredLanguage')}>
          <option value="en">{t('languages.en')}</option>
          <option value="so">{t('languages.so')}</option>
        </Select>
      </FormField>
      <Button type="submit" className="self-start" loading={form.formState.isSubmitting}>
        {t('common.save')}
      </Button>
    </form>
  );
}

function PasswordForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await apiPatch('/users/me/password', v);
      form.reset();
      toast(t('dashboard.passwordChanged'));
    } catch (err) {
      setError(applyServerErrors(err, form.setError).message);
    }
  });
  const e = form.formState.errors;
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-lg border border-border bg-background p-6"
    >
      <h2 className="text-lg">{t('dashboard.changePassword')}</h2>
      {error && <AlertMessage tone="danger">{error}</AlertMessage>}
      <FormField label={t('dashboard.currentPassword')} error={e.currentPassword?.message}>
        <Input type="password" autoComplete="current-password" {...form.register('currentPassword')} />
      </FormField>
      <FormField label={t('auth.newPassword')} hint={t('auth.passwordHint')} error={e.newPassword?.message}>
        <Input type="password" autoComplete="new-password" {...form.register('newPassword')} />
      </FormField>
      <FormField label={t('auth.confirmPassword')} error={e.confirmPassword?.message}>
        <Input type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
      </FormField>
      <Button type="submit" className="self-start" loading={form.formState.isSubmitting}>
        {t('dashboard.changePassword')}
      </Button>
    </form>
  );
}
