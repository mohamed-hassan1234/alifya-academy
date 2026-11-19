import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faCalendarDays, faClock, faLocationDot } from '@fortawesome/free-solid-svg-icons';
import type { PublicWebinarSummaryDto, WebinarDisplayStatus } from '@alifya/shared';
import { LogoMark } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { formatEventDate, formatEventTimeRange } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Alifya webinar visual system, after the official poster: deep forest green, a faint technical grid,
 * a peach "Webinar" pill, white editorial type and a framed speaker portrait. Used for featured banners
 * and the detail hero only — listings stay on white surfaces.
 */
export const POSTER_SURFACE =
  'bg-brand text-white [background-image:linear-gradient(rgb(255_255_255/0.045)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.045)_1px,transparent_1px)] [background-size:44px_44px]';

const STATUS_TONE: Record<WebinarDisplayStatus, string> = {
  registration_open: 'border-success/30 bg-success/10 text-success',
  live: 'border-danger/30 bg-danger/10 text-danger',
  upcoming: 'border-info/30 bg-info/10 text-info',
  registration_closed: 'border-warning/30 bg-warning/10 text-warning',
  completed: 'border-border bg-mint text-muted-foreground',
  cancelled: 'border-border bg-mint text-muted-foreground line-through decoration-1',
};

export function WebinarStatusBadge({
  status,
  onDark = false,
}: {
  status: WebinarDisplayStatus;
  onDark?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        onDark ? 'border-white/25 bg-white/10 text-white' : STATUS_TONE[status],
      )}
    >
      {status === 'live' && (
        <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" aria-hidden />
      )}
      {t(`webinars.status.${status}`)}
    </span>
  );
}

export function WebinarPill({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-[rgb(23_51_44)]">
      {children ?? t('webinars.pill')}
    </span>
  );
}

/** Date / time / venue lines in the event's own time zone. */
export function WebinarWhen({
  w,
  className,
  iconClassName = 'text-accent-strong',
}: {
  w: Pick<PublicWebinarSummaryDto, 'startsAt' | 'endsAt' | 'timezone' | 'platform' | 'venue'>;
  className?: string;
  iconClassName?: string;
}) {
  const { t, i18n } = useTranslation();
  const place = w.venue || t(`webinars.platform.${w.platform}`);
  return (
    <ul className={cn('space-y-1.5 text-sm', className)}>
      <li className="flex items-center gap-2.5">
        <FontAwesomeIcon icon={faCalendarDays} className={cn('w-4', iconClassName)} aria-hidden />
        {formatEventDate(w.startsAt, i18n.language, w.timezone)}
      </li>
      <li className="flex items-center gap-2.5">
        <FontAwesomeIcon icon={faClock} className={cn('w-4', iconClassName)} aria-hidden />
        {formatEventTimeRange(w.startsAt, w.endsAt, i18n.language, w.timezone)}
      </li>
      <li className="flex items-center gap-2.5">
        <FontAwesomeIcon icon={faLocationDot} className={cn('w-4', iconClassName)} aria-hidden />
        {place}
      </li>
    </ul>
  );
}

/** Poster image, or a generated poster in the brand style when none was uploaded. */
export function WebinarPoster({ w, className }: { w: PublicWebinarSummaryDto; className?: string }) {
  if (w.posterUrl)
    return (
      <img
        src={w.posterUrl}
        alt=""
        loading="lazy"
        className={cn('aspect-[4/5] w-full rounded-lg bg-brand object-cover', className)}
      />
    );
  const speaker = w.speakers[0];
  return (
    <div
      aria-hidden
      className={cn(
        'flex aspect-[4/5] w-full flex-col items-center rounded-lg p-5 text-center',
        POSTER_SURFACE,
        className,
      )}
    >
      <LogoMark className="h-10 rounded-lg" />
      <span className="mt-4">
        <WebinarPill />
      </span>
      <span className="mt-3 line-clamp-3 font-display text-lg leading-tight">{w.title}</span>
      {speaker?.photoUrl && (
        <img
          src={speaker.photoUrl}
          alt=""
          className="mt-auto h-20 w-20 rounded-xl border-2 border-white/80 object-cover object-top"
        />
      )}
      {speaker && <span className="mt-2 text-xs font-semibold text-accent">{speaker.name}</span>}
    </div>
  );
}

/** Editorial listing card: poster on the left, details on the right. */
export function WebinarCard({ w }: { w: PublicWebinarSummaryDto }) {
  const { t } = useTranslation();
  const speaker = w.speakers[0];
  return (
    <article className="group relative grid grid-cols-[7.5rem_1fr] gap-5 rounded-xl border border-border bg-background p-4 transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-card sm:grid-cols-[10rem_1fr] sm:p-5">
      <WebinarPoster w={w} className="self-start" />
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <WebinarStatusBadge status={w.status} />
          {w.topic && (
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-strong">
              {w.topic}
            </span>
          )}
        </div>
        <h3 className="mt-3 text-lg leading-snug">
          <Link
            to={`/webinars/${w.slug}`}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
          >
            {w.title}
          </Link>
        </h3>
        {speaker && (
          <p className="mt-2 flex items-center gap-2.5 text-sm">
            {speaker.photoUrl && (
              <img
                src={speaker.photoUrl}
                alt=""
                className="h-7 w-7 rounded-full border border-border object-cover object-top"
              />
            )}
            <span className="min-w-0">
              <span className="font-semibold text-foreground">{speaker.name}</span>
              {speaker.title && (
                <span className="block truncate text-xs text-muted-foreground">{speaker.title}</span>
              )}
            </span>
          </p>
        )}
        <WebinarWhen w={w} className="mt-4 text-muted-foreground" />
        <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-semibold text-primary">
          {w.status === 'registration_open' ? t('webinars.registerCta') : t('webinars.viewDetails')}
          <FontAwesomeIcon
            icon={faArrowRight}
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </article>
  );
}

/** Featured banner in the poster style. */
export function FeaturedWebinar({ w }: { w: PublicWebinarSummaryDto }) {
  const { t } = useTranslation();
  const speaker = w.speakers[0];
  return (
    <section className={cn('overflow-hidden rounded-xl', POSTER_SURFACE)} aria-label={t('webinars.featured')}>
      <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-14 lg:p-12">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <WebinarPill />
            <WebinarStatusBadge status={w.status} onDark />
          </div>
          <h2 className="mt-5 text-[clamp(1.8rem,1.2rem+2vw,2.75rem)] leading-[1.08] text-white">
            {w.title}
          </h2>
          {w.subtitle && <p className="mt-3 text-lg text-white/80">{w.subtitle}</p>}
          {speaker && (
            <div className="mt-7">
              <span className="inline-flex rounded-sm bg-accent px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[rgb(23_51_44)]">
                {t('webinars.guest')}
              </span>
              <p className="mt-2 font-display text-2xl text-white">{speaker.name}</p>
              {(speaker.title || speaker.organization) && (
                <p className="text-sm text-white/75">
                  {[speaker.title, speaker.organization].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          )}
          <WebinarWhen w={w} className="mt-7 text-white/90" iconClassName="text-accent" />
          <div className="mt-8">
            <Button variant="accent" asChild>
              <Link to={`/webinars/${w.slug}`}>
                {w.status === 'registration_open' ? t('webinars.registerCta') : t('webinars.viewDetails')}
                <FontAwesomeIcon icon={faArrowRight} aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[19rem]">
          <WebinarPoster w={w} className="border border-white/15 shadow-lift" />
        </div>
      </div>
    </section>
  );
}
