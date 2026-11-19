import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCircleInfo, faHourglassHalf } from '@fortawesome/free-solid-svg-icons';
import type { MyCourseStatusDto, PublicCourseDto } from '@alifya/shared';
import { useConfirm } from '@/components/shared';
import { useToast } from '@/components/shared/toast';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/feedback';
import { Label, Textarea } from '@/components/ui/form-controls';
import { useAuth } from '@/features/auth/AuthProvider';
import { apiGet, apiPost, normalizeError } from '@/lib/api';
import { formatDate } from '@/lib/format';

/**
 * Course application call-to-action. Signing in is required; the server decides whether applying is
 * possible (registration window, seats, existing applications/enrolment) and the panel reflects that.
 */
export function ApplyPanel({ course }: { course: PublicCourseDto }) {
  const { t, i18n } = useTranslation();
  const { user, initializing } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [motivation, setMotivation] = useState('');
  const key = ['course', course.slug, 'my-status'];

  const status = useQuery({
    queryKey: key,
    queryFn: () => apiGet<MyCourseStatusDto>(`/courses/${course.slug}/my-status`),
    enabled: !!user,
  });
  const apply = useMutation({
    mutationFn: () => apiPost<MyCourseStatusDto>(`/courses/${course.slug}/applications`, { motivation }),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      void qc.invalidateQueries({ queryKey: ['me', 'learning'] });
      setOpen(false);
      setMotivation('');
      toast(t('apply.submittedToast'));
    },
    onError: (err) => toast(normalizeError(err).message, 'danger'),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => apiPost(`/me/applications/${id}/withdraw`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ['me', 'learning'] });
      toast(t('apply.withdrawnToast'));
    },
    onError: (err) => toast(normalizeError(err).message, 'danger'),
  });

  // Signed out: applying needs an account.
  if (!user) {
    if (initializing) return <Skeleton className="h-12 w-full" />;
    if (!course.registrationOpen) return <ClosedNote />;
    return (
      <div className="space-y-3">
        <Button asChild size="lg" className="w-full">
          <Link to="/login" state={{ from: location.pathname }}>
            {t('apply.signInToApply')}
          </Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t('apply.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            {t('nav.register')}
          </Link>
        </p>
      </div>
    );
  }

  if (status.isPending) return <Skeleton className="h-12 w-full" />;
  if (status.isError) return <p className="text-sm text-danger">{normalizeError(status.error).message}</p>;
  const { application, enrollment, canApply } = status.data;

  if (enrollment?.status === 'active')
    return (
      <StateBox icon={faCircleCheck} tone="success" title={t('apply.enrolled')}>
        <Button asChild variant="secondary" className="mt-4 w-full">
          <Link to="/student/dashboard">{t('apply.goToDashboard')}</Link>
        </Button>
      </StateBox>
    );
  if (enrollment?.status === 'pending_payment')
    return (
      <StateBox
        icon={faHourglassHalf}
        tone="warning"
        title={t('apply.admittedPayment')}
        body={t('apply.admittedPaymentBody')}
      />
    );

  if (application?.status === 'submitted')
    return (
      <>
        {dialog}
        <StateBox
          icon={faHourglassHalf}
          tone="info"
          title={t('apply.underReview')}
          body={t('apply.submittedOn', { date: formatDate(application.submittedAt, i18n.language) })}
        >
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full text-danger"
            loading={withdraw.isPending}
            onClick={async () => {
              if (await confirm(t('apply.withdrawTitle'), t('apply.withdrawBody'), true))
                withdraw.mutate(application.id);
            }}
          >
            {t('apply.withdraw')}
          </Button>
        </StateBox>
      </>
    );

  return (
    <div className="space-y-3">
      {application?.status === 'rejected' && (
        <p className="rounded-lg border border-border bg-ivory p-3 text-sm">
          {t('apply.previousRejected')}
          {application.decisionNote ? ` — ${application.decisionNote}` : ''}
        </p>
      )}
      {canApply ? (
        <>
          <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
            {t('courses.apply')}
          </Button>
          <p className="flex gap-2 text-xs text-muted-foreground">
            <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5" aria-hidden />
            {course.isFree ? t('apply.freeNote') : t('apply.paidNote')}
          </p>
          <Modal
            open={open}
            onOpenChange={setOpen}
            title={t('apply.modalTitle')}
            description={course.title}
            footer={
              <>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button loading={apply.isPending} onClick={() => apply.mutate()}>
                  {t('apply.submit')}
                </Button>
              </>
            }
          >
            <div className="space-y-2">
              <Label htmlFor="motivation">{t('apply.motivation')}</Label>
              <Textarea
                id="motivation"
                rows={5}
                maxLength={1500}
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder={t('apply.motivationPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('apply.motivationHint')}</p>
            </div>
          </Modal>
        </>
      ) : (
        <ClosedNote />
      )}
    </div>
  );
}

function ClosedNote() {
  const { t } = useTranslation();
  return (
    <p className="rounded-md bg-mint p-3 text-sm text-foreground/85">{t('courses.registrationClosedNote')}</p>
  );
}

function StateBox({
  icon,
  tone,
  title,
  body,
  children,
}: {
  icon: typeof faCircleCheck;
  tone: 'success' | 'info' | 'warning';
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  const color = { success: 'text-success', info: 'text-info', warning: 'text-warning' }[tone];
  return (
    <div className="rounded-lg border border-border bg-ivory p-4" role="status">
      <p className={`flex items-center gap-2 font-semibold ${color}`}>
        <FontAwesomeIcon icon={icon} aria-hidden /> {title}
      </p>
      {body && <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>}
      {children}
    </div>
  );
}
