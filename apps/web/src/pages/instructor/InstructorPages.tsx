import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendar, faChalkboardUser, faListCheck } from '@fortawesome/free-solid-svg-icons';
import type { AdminInstructorDto, InstructorCourseDto } from '@alifya/shared';
import { DashboardPageHeader } from '@/components/layout/DashboardLayout';
import { EmptyState, ErrorState, StatusBadge } from '@/components/shared';
import { TableSkeleton } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthProvider';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { usePageMeta } from '@/lib/seo';
import { InstructorProfileForm } from '@/pages/admin/AcademicAdminPages';

/** Lecturer portal overview: only courses the instructor is assigned to (enforced server-side). */
export function InstructorDashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  usePageMeta({ title: 'Teaching', noindex: true });
  const courses = useQuery({
    queryKey: ['instructor', 'courses'],
    queryFn: () => apiGet<InstructorCourseDto[]>('/instructor/courses'),
  });
  const sessions =
    courses.data?.flatMap((c) => c.schedule.map((s) => ({ ...s, course: c.title, tz: c.timezone }))) ?? [];

  return (
    <>
      <DashboardPageHeader
        title={t('dashboard.welcome', { name: user?.fullName.split(' ')[0] ?? '' })}
        description="Your assigned courses and weekly teaching schedule."
      />
      {courses.isPending ? (
        <TableSkeleton rows={4} />
      ) : courses.isError ? (
        <ErrorState onRetry={() => void courses.refetch()} />
      ) : courses.data.length === 0 ? (
        <EmptyState
          icon={faChalkboardUser}
          title="No courses are assigned to you yet."
          description="An administrator assigns instructors from the course editor."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section>
            <h2 className="mb-4 text-xl">My assigned courses</h2>
            <ul className="grid gap-4">
              {courses.data.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-4 rounded-lg border border-border bg-background p-5 sm:flex-row sm:items-center"
                >
                  <div className="h-20 w-full shrink-0 overflow-hidden rounded-md bg-mint sm:w-32">
                    {c.thumbnailUrl ? (
                      <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full bg-primary" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg">{c.title}</h3>
                      <StatusBadge
                        status={c.publicationStatus === 'published' ? c.displayStatus : c.publicationStatus}
                      />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <FontAwesomeIcon icon={faListCheck} aria-hidden /> {c.publishedLessonCount} of{' '}
                      {c.lessonCount} lessons published
                      {c.startDate && (
                        <>
                          {' · '}
                          <FontAwesomeIcon icon={faCalendar} aria-hidden />{' '}
                          {formatDate(c.startDate, i18n.language, c.timezone)}
                          {c.endDate && ` – ${formatDate(c.endDate, i18n.language, c.timezone)}`}
                        </>
                      )}
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link to={`/instructor/courses/${c.id}/curriculum`}>Manage lessons</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border border-border bg-background p-5">
            <h2 className="mb-3 text-lg">Weekly teaching schedule</h2>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No weekly sessions are scheduled on your courses.
              </p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {sessions.map((s, i) => (
                  <li key={i} className="py-2.5">
                    <p className="font-semibold">
                      {t(`weekdays.${s.day}`)} · {s.startTime}–{s.endTime}
                    </p>
                    <p className="text-muted-foreground">
                      {s.course} <span className="text-xs">({s.tz})</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export function InstructorProfilePage() {
  usePageMeta({ title: 'Professional profile', noindex: true });
  const me = useQuery({
    queryKey: ['instructor-self'],
    queryFn: () => apiGet<AdminInstructorDto>('/instructor/profile'),
  });
  return (
    <>
      <DashboardPageHeader
        title="Professional profile"
        description="Shown on the public Instructors page when you choose to make it public."
      />
      {me.isPending ? (
        <TableSkeleton rows={5} />
      ) : me.isError ? (
        <ErrorState onRetry={() => void me.refetch()} />
      ) : (
        <div className="rounded-lg border border-border bg-background p-5 sm:p-6">
          <InstructorProfileForm key={me.dataUpdatedAt} endpoint="/instructor/profile" initial={me.data} />
        </div>
      )}
    </>
  );
}
