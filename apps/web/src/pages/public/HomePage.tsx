import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { EmptyState, ErrorState, SectionHeading } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { useAuth, dashboardPathFor } from '@/features/auth/AuthProvider';
import { CourseCard } from '@/features/courses/CourseCard';
import { FALLBACK_SETTINGS, useCourses, useSiteSettings } from '@/lib/queries';
import { usePageMeta } from '@/lib/seo';

export function CourseGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-border">
          <Skeleton className="aspect-[16/10] rounded-none" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: s = FALLBACK_SETTINGS } = useSiteSettings();
  // Featured first, then most recently published — real records only.
  const featured = useCourses({ limit: 6, sort: 'newest' });
  usePageMeta({ title: s.academyName, description: s.hero.subtitle ?? t('home.heroSubtitle') });

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ivory">
        <div className="container grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="max-w-2xl">
            <p className="eyebrow mb-5">{t('home.eyebrow')}</p>
            <h1>{s.hero.title ?? t('home.heroTitle')}</h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {s.hero.subtitle ?? t('home.heroSubtitle')}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/courses">
                  {t('home.exploreCourses')} <FontAwesomeIcon icon={faArrowRight} aria-hidden />
                </Link>
              </Button>
              {user ? (
                <Button size="lg" variant="secondary" asChild>
                  <Link to={dashboardPathFor(user)}>{t('nav.dashboard')}</Link>
                </Button>
              ) : (
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/register">{t('home.createAccount')}</Link>
                </Button>
              )}
            </div>
          </div>
          {s.hero.imageUrl ? (
            <img
              src={s.hero.imageUrl}
              alt=""
              className="aspect-[4/5] w-full rounded-lg object-cover shadow-card lg:aspect-[4/5]"
            />
          ) : (
            // Decorative brand composition until a real academy photograph is configured in Site Settings.
            <div aria-hidden className="relative hidden aspect-[4/5] lg:block">
              <div className="absolute inset-0 rounded-lg bg-primary" />
              <div className="absolute -bottom-6 -left-6 h-40 w-40 rounded-lg bg-accent/90" />
              <div className="absolute inset-x-10 top-10 border-t border-white/20" />
            </div>
          )}
        </div>
      </section>

      {/* Featured courses */}
      <section className="container py-16 sm:py-24">
        <SectionHeading
          eyebrow={t('home.featuredEyebrow')}
          title={t('home.featuredTitle')}
          action={
            <Link
              to="/courses"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              {t('home.featuredLink')} <FontAwesomeIcon icon={faArrowRight} aria-hidden />
            </Link>
          }
        />
        {featured.isPending ? (
          <CourseGridSkeleton />
        ) : featured.isError ? (
          <ErrorState onRetry={() => void featured.refetch()} />
        ) : featured.data.data.length === 0 ? (
          <EmptyState title={t('courses.empty')} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.data.data.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      {!user && (
        <section className="bg-mint">
          <div className="container flex flex-col items-start gap-6 py-14 sm:py-16 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2>{t('home.ctaTitle')}</h2>
              <p className="mt-3 text-muted-foreground">{t('home.ctaBody')}</p>
            </div>
            <Button size="lg" asChild>
              <Link to="/register">{t('home.createAccount')}</Link>
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
