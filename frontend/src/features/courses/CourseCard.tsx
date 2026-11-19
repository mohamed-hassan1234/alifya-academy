import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendar, faClock, faUser } from '@fortawesome/free-regular-svg-icons';
import { faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import type { PublicCourseDto } from '@alifya/shared';
import { StatusBadge } from '@/components/shared';
import { formatDate, formatMoney } from '@/lib/format';

export function CourseCard({ course }: { course: PublicCourseDto }) {
  const { t, i18n } = useTranslation();
  const instructor = course.instructors[0]?.fullName;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background transition-[box-shadow,transform] duration-200 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[16/10] overflow-hidden bg-mint">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-end bg-gradient-to-br from-brand to-brand-hover p-5">
            <span className="font-display text-xl leading-tight text-white/90">{course.title}</span>
          </div>
        )}
        <div className="absolute left-3 top-3">
          <StatusBadge status={course.displayStatus} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        {course.category && <p className="eyebrow mb-2">{course.category.name}</p>}
        <h3 className="text-lg">
          <Link
            to={`/courses/${course.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {course.title}
          </Link>
        </h3>
        {course.subtitle && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{course.subtitle}</p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[0.8rem] text-muted-foreground">
          {instructor && (
            <div className="col-span-2 flex items-center gap-2">
              <dt className="sr-only">{t('courses.instructor')}</dt>
              <FontAwesomeIcon icon={faUser} aria-hidden />
              <dd className="truncate">{instructor}</dd>
            </div>
          )}
          {course.durationText && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">{t('courses.duration')}</dt>
              <FontAwesomeIcon icon={faClock} aria-hidden />
              <dd>{course.durationText}</dd>
            </div>
          )}
          <div className="flex items-center gap-2">
            <dt className="sr-only">{t('courses.level')}</dt>
            <FontAwesomeIcon icon={faLayerGroup} aria-hidden />
            <dd>{t(`levels.${course.level}`)}</dd>
          </div>
          {course.startDate && (
            <div className="col-span-2 flex items-center gap-2">
              <dt className="sr-only">{t('courses.starts')}</dt>
              <FontAwesomeIcon icon={faCalendar} aria-hidden />
              <dd>{formatDate(course.startDate, i18n.language, course.timezone)}</dd>
            </div>
          )}
        </dl>
        <div className="flex-1" />
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <span className="text-base font-bold text-primary">
            {course.isFree ? t('common.free') : formatMoney(course.feeAmount, course.currency, i18n.language)}
          </span>
          {course.seatsRemaining != null && course.seatsRemaining > 0 && course.registrationOpen && (
            <span className="text-xs font-semibold text-accent-strong">
              {t('courses.seatsLeft', { count: course.seatsRemaining })}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
