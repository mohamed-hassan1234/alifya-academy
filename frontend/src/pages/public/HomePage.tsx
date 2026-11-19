import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { EmptyState, ErrorState, SectionHeading } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { useAuth } from '@/features/auth/AuthProvider';
import { CourseCard } from '@/features/courses/CourseCard';
import { FALLBACK_SETTINGS, useCourses, useInstructors, usePrograms, useSiteSettings } from '@/lib/queries';
import { InstructorCard, ProgramCard } from '@/features/public/cards';
import { usePageMeta } from '@/lib/seo';
import { HomeHero } from './HomeHero';
import { HomeWebinars } from './HomeWebinars';

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
  const programs = usePrograms({ limit: 4 });
  const instructors = useInstructors({ limit: 4 });
  usePageMeta({ title: s.academyName, description: s.hero.subtitle ?? t('home.heroSubtitle') });

  return (
    <>
      <HomeHero />

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

      <HomeWebinars />

      {/* Academic programs — rendered only when published programs exist */}
      {programs.data && programs.data.data.length > 0 && (
        <section className="bg-ivory">
          <div className="container py-16 sm:py-24">
            <SectionHeading
              eyebrow={t('programs.eyebrow')}
              title={t('programs.homeTitle')}
              action={
                <Link
                  to="/programs"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  {t('programs.seeAll')} <FontAwesomeIcon icon={faArrowRight} aria-hidden />
                </Link>
              }
            />
            <div className="grid gap-6 lg:grid-cols-2">
              {programs.data.data.map((p) => (
                <ProgramCard key={p.id} program={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Instructor highlights — real public profiles only */}
      {instructors.data && instructors.data.data.length > 0 && (
        <section className="container py-16 sm:py-24">
          <SectionHeading
            eyebrow={t('instructors.eyebrow')}
            title={t('instructors.homeTitle')}
            action={
              <Link
                to="/instructors"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                {t('instructors.seeAll')} <FontAwesomeIcon icon={faArrowRight} aria-hidden />
              </Link>
            }
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {instructors.data.data.map((i) => (
              <InstructorCard key={i.id} instructor={i} />
            ))}
          </div>
        </section>
      )}

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
