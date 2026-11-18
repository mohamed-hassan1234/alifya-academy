import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { SectionHeading } from '@/components/shared';
import { FeaturedWebinar, WebinarCard } from '@/features/webinars/WebinarVisuals';
import { useWebinars } from '@/lib/queries';

/** Homepage "Upcoming webinars" — renders nothing unless real upcoming webinars exist. */
export function HomeWebinars() {
  const { t } = useTranslation();
  const upcoming = useWebinars({ when: 'upcoming', limit: 3 });
  const items = upcoming.data?.data ?? [];
  if (!items.length) return null;
  const [first, ...rest] = items;
  return (
    <section className="border-t border-border">
      <div className="container py-16 sm:py-24">
        <SectionHeading
          eyebrow={t('webinars.eyebrow')}
          title={t('webinars.homeTitle')}
          action={
            <Link
              to="/webinars"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              {t('webinars.homeLink')} <FontAwesomeIcon icon={faArrowRight} aria-hidden />
            </Link>
          }
        />
        <FeaturedWebinar w={first!} />
        {rest.length > 0 && (
          <ul className="mt-6 grid gap-6 lg:grid-cols-2">
            {rest.map((w) => (
              <li key={w.id}>
                <WebinarCard w={w} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
