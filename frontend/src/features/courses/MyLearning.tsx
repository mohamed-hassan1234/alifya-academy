import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookOpen, faGraduationCap } from '@fortawesome/free-solid-svg-icons';
import type {
  ApplicationCourseDto,
  ApplicationStatus,
  EnrollmentStatus,
  MyLearningDto,
} from '@alifya/shared';
import { ErrorState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const TONE: Record<ApplicationStatus | EnrollmentStatus, string> = {
  active: 'border-success/30 bg-success/10 text-success',
  approved: 'border-success/30 bg-success/10 text-success',
  pending_payment: 'border-warning/30 bg-warning/10 text-warning',
  submitted: 'border-info/30 bg-info/10 text-info',
  rejected: 'border-border bg-mint text-muted-foreground',
  withdrawn: 'border-border bg-mint text-muted-foreground',
  cancelled: 'border-border bg-mint text-muted-foreground',
};

function Pill({ status }: { status: ApplicationStatus | EnrollmentStatus }) {
  const { t } = useTranslation();
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold', TONE[status])}>
      {t(`apply.status.${status}`)}
    </span>
  );
}

function Row({ course, children }: { course: ApplicationCourseDto; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-4 p-4">
      {course.thumbnailUrl ? (
        <img
          src={course.thumbnailUrl}
          alt=""
          className="h-12 w-16 shrink-0 rounded-md border border-border bg-white object-contain"
        />
      ) : (
        <span className="grid h-12 w-16 shrink-0 place-items-center rounded-md bg-mint text-primary">
          <FontAwesomeIcon icon={faBookOpen} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Link
          to={`/courses/${course.slug}`}
          className="font-semibold text-foreground hover:text-primary hover:underline"
        >
          {course.title}
        </Link>
        {children}
      </div>
    </li>
  );
}

/** Student dashboard: enrolled courses first, then open/decided applications. Real records only. */
export function MyLearning() {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['me', 'learning'], queryFn: () => apiGet<MyLearningDto>('/me/learning') });

  if (q.isPending) return <Skeleton className="h-48 w-full" />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;
  const { enrollments, applications } = q.data;
  // Applications that already became an enrolment are shown once, under "My courses".
  const enrolledCourses = new Set(enrollments.map((e) => e.course.id));
  const pending = applications.filter((a) => !(a.status === 'approved' && enrolledCourses.has(a.course.id)));

  if (!enrollments.length && !pending.length)
    return (
      <section className="rounded-xl border border-border bg-background p-6 sm:p-8">
        <span className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-mint text-primary">
          <FontAwesomeIcon icon={faGraduationCap} aria-hidden />
        </span>
        <h2 className="text-xl">{t('apply.dashEmptyTitle')}</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {t('apply.dashEmptyBody')}
        </p>
        <Button asChild className="mt-6">
          <Link to="/courses">
            <FontAwesomeIcon icon={faBookOpen} aria-hidden /> {t('dashboard.browseCourses')}
          </Link>
        </Button>
      </section>
    );

  return (
    <div className="space-y-6">
      {enrollments.length > 0 && (
        <section className="rounded-xl border border-border bg-background">
          <h2 className="border-b border-border px-5 py-4 text-lg">{t('apply.myCourses')}</h2>
          <ul className="divide-y divide-border">
            {enrollments.map((e) => (
              <Row key={e.id} course={e.course}>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Pill status={e.status} />
                  {t('apply.enrolledOn', { date: formatDate(e.enrolledAt, i18n.language) })}
                </p>
                {e.status === 'pending_payment' && (
                  <p className="mt-1 text-xs text-muted-foreground">{t('apply.admittedPaymentBody')}</p>
                )}
              </Row>
            ))}
          </ul>
        </section>
      )}
      {pending.length > 0 && (
        <section className="rounded-xl border border-border bg-background">
          <h2 className="border-b border-border px-5 py-4 text-lg">{t('apply.myApplications')}</h2>
          <ul className="divide-y divide-border">
            {pending.map((a) => (
              <Row key={a.id} course={a.course}>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Pill status={a.status} />
                  {t('apply.submittedOn', { date: formatDate(a.submittedAt, i18n.language) })}
                </p>
                {a.decisionNote && <p className="mt-1 text-xs text-muted-foreground">“{a.decisionNote}”</p>}
              </Row>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
