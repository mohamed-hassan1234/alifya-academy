import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { faCalendar, faClock, faUser } from '@fortawesome/free-regular-svg-icons';
import { ApplyPanel } from '@/features/courses/ApplyPanel';
import { CurriculumOutline } from '@/features/courses/CurriculumOutline';
import { BackLink, EmptyState, ErrorState, StatusBadge } from '@/components/shared';
import { Skeleton } from '@/components/ui/feedback';
import { formatDate, formatMoney } from '@/lib/format';
import { normalizeError } from '@/lib/api';
import { useCourse } from '@/lib/queries';
import { usePageMeta } from '@/lib/seo';

export function CourseDetailPage() {
  const { slug = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { data: c, isPending, isError, error, refetch } = useCourse(slug);
  usePageMeta({
    title: c?.title ?? t('courses.title'),
    description: c?.subtitle || c?.description.slice(0, 160),
    image: c?.thumbnailUrl,
  });

  if (isPending) {
    return (
      <div className="container py-14" aria-busy="true">
        <Skeleton className="mb-4 h-10 w-2/3" />
        <Skeleton className="mb-8 h-5 w-1/2" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="container py-14">
        {normalizeError(error).status === 404 ? (
          <EmptyState
            title={t('courses.notFound')}
            action={<BackLink to="/courses">{t('courses.title')}</BackLink>}
          />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )}
      </div>
    );
  }

  const lang = i18n.language;
  return (
    <article>
      <header className="border-b border-border bg-ivory">
        <div className="container py-10 sm:py-14">
          <BackLink to="/courses">{t('courses.title')}</BackLink>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {c.category && <span className="eyebrow">{c.category.name}</span>}
            <StatusBadge status={c.displayStatus} />
          </div>
          <h1 className="mt-4 max-w-4xl">{c.title}</h1>
          {c.subtitle && <p className="mt-4 max-w-3xl text-lg text-muted-foreground">{c.subtitle}</p>}
          {c.instructors.length > 0 && (
            <p className="mt-6 flex items-center gap-2 text-sm text-foreground/80">
              <FontAwesomeIcon icon={faUser} aria-hidden />
              <span className="sr-only">{t('courses.instructor')}:</span>
              {c.instructors.map((i) => i.fullName).join(', ')}
            </p>
          )}
        </div>
      </header>

      <div className="container grid gap-10 py-12 lg:grid-cols-[1fr_22rem] lg:gap-14">
        <div className="min-w-0">
          {c.thumbnailUrl && (
            <img src={c.thumbnailUrl} alt="" className="mb-10 aspect-[16/9] w-full rounded-lg object-cover" />
          )}
          {c.description && (
            <section className="mb-10">
              <h2 className="mb-4 text-2xl">{t('courses.about')}</h2>
              <div className="max-w-prose whitespace-pre-line leading-relaxed text-foreground/90">
                {c.description}
              </div>
            </section>
          )}
          {c.learningObjectives.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-2xl">{t('courses.objectives')}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {c.learningObjectives.map((o) => (
                  <li key={o} className="flex gap-3 rounded-md bg-mint p-3.5 text-sm">
                    <FontAwesomeIcon icon={faCheck} className="mt-1 text-primary" aria-hidden />
                    {o}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {c.entryRequirements.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-2xl">{t('courses.requirements')}</h2>
              <ul className="list-disc space-y-2 pl-5 text-foreground/90">
                {c.entryRequirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}
          <CurriculumOutline slug={c.slug} />
          {c.schedule.length > 0 && (
            <section>
              <h2 className="mb-2 text-2xl">{t('courses.schedule')}</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {t('courses.timezoneNote', { tz: c.timezone })}
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {c.schedule.map((s) => (
                  <li key={`${s.day}-${s.startTime}`} className="flex justify-between px-4 py-3 text-sm">
                    <span className="font-semibold">{t(`weekdays.${s.day}`)}</span>
                    <span>
                      {s.startTime} – {s.endTime}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* PaymentSummary-style enrolment card */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border border-border bg-background p-6 shadow-card">
            <p className="text-sm text-muted-foreground">{t('courses.fee')}</p>
            <p className="mt-1 font-display text-4xl text-primary">
              {c.isFree ? t('common.free') : formatMoney(c.feeAmount, c.currency, lang)}
            </p>
            <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
              {c.startDate && (
                <Row
                  icon={faCalendar}
                  label={t('courses.starts')}
                  value={formatDate(c.startDate, lang, c.timezone)}
                />
              )}
              {c.endDate && (
                <Row
                  icon={faCalendar}
                  label={t('courses.ends')}
                  value={formatDate(c.endDate, lang, c.timezone)}
                />
              )}
              {c.durationText && <Row icon={faClock} label={t('courses.duration')} value={c.durationText} />}
              <Row label={t('courses.level')} value={t(`levels.${c.level}`)} />
              <Row label={t('courses.language')} value={t(`languages.${c.language}`)} />
              {c.seatsRemaining != null && (
                <Row
                  label={t('courses.registration')}
                  value={t('courses.seatsLeft', { count: c.seatsRemaining })}
                />
              )}
            </dl>
            <div className="mt-6">
              <ApplyPanel course={c} />
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: Parameters<typeof FontAwesomeIcon>[0]['icon'];
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {icon && <FontAwesomeIcon icon={icon} aria-hidden />}
        {label}
      </dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}
