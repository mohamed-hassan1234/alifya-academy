import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import type { PublicInstructorDto, PublicProgramDto } from '@alifya/shared';

/** Initials avatar used ONLY when no real photograph exists. */
export function InitialsAvatar({
  name,
  className = 'h-full w-full text-3xl',
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className={`grid place-items-center bg-primary font-display text-white/90 ${className}`} aria-hidden>
      {initials}
    </div>
  );
}

export function InstructorCard({ instructor }: { instructor: PublicInstructorDto }) {
  const { t } = useTranslation();
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background transition-shadow hover:shadow-card">
      <div className="aspect-[4/5] overflow-hidden bg-mint">
        {instructor.photoUrl ? (
          <img
            src={instructor.photoUrl}
            alt={instructor.fullName}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <InitialsAvatar name={instructor.fullName} />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg">
          <Link to={`/instructors/${instructor.id}`} className="after:absolute after:inset-0">
            {instructor.fullName}
          </Link>
        </h3>
        {instructor.professionalTitle && (
          <p className="mt-1 text-sm font-semibold text-accent-strong">{instructor.professionalTitle}</p>
        )}
        {instructor.specialization && (
          <p className="mt-1 text-sm text-muted-foreground">{instructor.specialization}</p>
        )}
        {instructor.biography && (
          <p className="mt-3 line-clamp-3 text-sm text-foreground/80">{instructor.biography}</p>
        )}
        <span className="mt-auto pt-4 text-sm font-semibold text-primary">
          {t('instructors.viewProfile')} <FontAwesomeIcon icon={faArrowRight} aria-hidden />
        </span>
      </div>
    </article>
  );
}

export function ProgramCard({ program }: { program: PublicProgramDto }) {
  const { t } = useTranslation();
  return (
    <article className="group relative grid overflow-hidden rounded-lg border border-border bg-background transition-shadow hover:shadow-card sm:grid-cols-[14rem_1fr]">
      <div className="aspect-[16/10] bg-mint sm:aspect-auto">
        {program.imageUrl ? (
          <img src={program.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full min-h-32 place-items-center bg-primary text-white/80">
            <FontAwesomeIcon icon={faLayerGroup} className="text-2xl" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex flex-col p-5 sm:p-6">
        <h3 className="text-xl">
          <Link to={`/programs/${program.slug}`} className="after:absolute after:inset-0">
            {program.title}
          </Link>
        </h3>
        {program.summary && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{program.summary}</p>
        )}
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent-strong">
          {[program.durationText, t('courses.results', { count: program.courses.length })]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </article>
  );
}
