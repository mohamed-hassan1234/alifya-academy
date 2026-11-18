import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { usePageMeta } from '@/lib/seo';

export function NotFoundPage() {
  const { t } = useTranslation();
  usePageMeta({ title: t('errors.notFoundTitle'), noindex: true });
  return (
    <section className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-7xl text-accent">404</p>
      <h1 className="mt-4">{t('errors.notFoundTitle')}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t('errors.notFoundBody')}</p>
      <Button asChild className="mt-8">
        <Link to="/">{t('errors.goHome')}</Link>
      </Button>
    </section>
  );
}
