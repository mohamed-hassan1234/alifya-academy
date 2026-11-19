import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faBookOpen } from '@fortawesome/free-solid-svg-icons';
import { LogoMark } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { FALLBACK_SETTINGS, useCourses, useInstructors, useSiteSettings } from '@/lib/queries';

/**
 * Homepage hero — editorial and restrained: white surface, strong typography, one photograph.
 * Every figure and card comes from real records and disappears when there is no data.
 */
export function HomeHero() {
  const { t } = useTranslation();
  const { data: s = FALLBACK_SETTINGS } = useSiteSettings();
  // Same query keys as the sections below, so React Query shares the requests.
  const courses = useCourses({ limit: 6, sort: 'newest' });
  const instructors = useInstructors({ limit: 4 });
  const newest = courses.data?.data[0];

  // Split "Sentence one. Sentence two." so the second sentence can be set in a quieter tone.
  const title = s.hero.title ?? t('home.heroTitle');
  const split = title.match(/^(.+?[.!?])\s+(.+)$/);

  const facts = [
    { value: courses.data?.meta.total, label: t('home.statCourses') },
    { value: instructors.data?.meta.total, label: t('home.statInstructors') },
    { value: s.supportedLanguages.length, label: t('home.statLanguages') },
  ];

  return (
    <section className="border-b border-border bg-background">
      <div className="container grid items-center gap-14 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:py-24">
        {/* Copy */}
        <div className="max-w-2xl motion-safe:animate-fade-up">
          <p className="eyebrow flex items-center gap-3">
            <span className="h-px w-8 bg-accent" aria-hidden />
            {t('home.eyebrow')}
          </p>
          <h1 className="mt-6 text-[clamp(2.4rem,1.4rem+2.6vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.035em]">
            {split ? (
              <>
                <span className="block">{split[1]}</span>
                <span className="block text-muted-foreground">{split[2]}</span>
              </>
            ) : (
              title
            )}
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {s.hero.subtitle ?? t('home.heroSubtitle')}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/courses">
                {t('home.exploreCourses')} <FontAwesomeIcon icon={faArrowRight} aria-hidden />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/roadmaps">{t('home.discoverPaths')}</Link>
            </Button>
          </div>

          {/* Live figures from the database */}
          <dl className="mt-14 grid max-w-md grid-cols-3">
            {facts.map((f, i) => (
              <div key={f.label} className={i ? 'border-l border-border pl-6' : 'pr-6'}>
                <dd className="font-display text-3xl font-bold text-foreground">
                  {f.value ?? <span className="inline-block h-7 w-8 animate-pulse rounded bg-mint" />}
                </dd>
                <dt className="mt-1 text-sm text-muted-foreground">{f.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        {/* Photograph */}
        <div className="relative mx-auto w-full max-w-[25rem] motion-safe:animate-fade-up motion-safe:[animation-delay:120ms] lg:max-w-[28rem]">
          <div aria-hidden className="absolute -bottom-5 -left-5 h-2/5 w-3/5 rounded-xl bg-accent/70" />
          {s.hero.imageUrl ? (
            <img
              src={s.hero.imageUrl}
              alt=""
              className="relative aspect-[4/5] w-full rounded-xl border border-border bg-mint object-cover"
            />
          ) : (
            <div className="relative grid aspect-[4/5] w-full place-items-center rounded-xl bg-brand">
              <LogoMark className="h-24 rounded-2xl" />
            </div>
          )}

          {newest && (
            <Link
              to={`/courses/${newest.slug}`}
              className="absolute -right-3 bottom-8 flex w-64 items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-card transition-colors hover:border-border-strong sm:-right-8"
            >
              {newest.thumbnailUrl ? (
                <img
                  src={newest.thumbnailUrl}
                  alt=""
                  className="h-12 w-16 shrink-0 rounded-md border border-border bg-white object-contain"
                />
              ) : (
                <span className="grid h-12 w-16 shrink-0 place-items-center rounded-md bg-mint text-primary">
                  <FontAwesomeIcon icon={faBookOpen} aria-hidden />
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-accent-strong">
                  {t('home.heroNewCourse')}
                </span>
                <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                  {newest.title}
                </span>
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
