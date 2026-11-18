import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { COURSE_LEVELS, COURSE_SORTS } from '@alifya/shared';
import { EmptyState, ErrorState, PageHeader, Pagination } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/form-controls';
import { CourseCard } from '@/features/courses/CourseCard';
import { useCategories, useCourses } from '@/lib/queries';
import { usePageMeta } from '@/lib/seo';
import { CourseGridSkeleton } from './HomePage';

const SORT_LABELS: Record<(typeof COURSE_SORTS)[number], string> = {
  newest: 'courses.sortNewest',
  start_date: 'courses.sortStart',
  title: 'courses.sortTitle',
  fee_low: 'courses.sortFeeLow',
  fee_high: 'courses.sortFeeHigh',
};

const FILTER_KEYS = ['q', 'category', 'level', 'price', 'registration', 'sort'] as const;

export function CoursesPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const categories = useCategories();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<
    (typeof FILTER_KEYS)[number],
    string
  >;
  const courses = useCourses({ ...filters, page, limit: 12 });
  const [search, setSearch] = useState(filters.q);
  useEffect(() => setSearch(filters.q), [filters.q]);
  usePageMeta({ title: t('courses.title'), description: t('courses.subtitle') });

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: key !== 'page' });
  };
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    update('q', search.trim());
  };
  const hasFilters = FILTER_KEYS.some((k) => k !== 'sort' && filters[k]);

  return (
    <>
      <PageHeader eyebrow="Alifya Academy" title={t('courses.title')} description={t('courses.subtitle')} />
      <div className="container py-10 sm:py-14">
        {/* FilterBar */}
        <div className="mb-8 rounded-lg border border-border bg-background p-4 sm:p-5">
          <form onSubmit={onSearch} role="search" className="mb-4 flex gap-2">
            <label htmlFor="course-search" className="sr-only">
              {t('courses.searchPlaceholder')}
            </label>
            <div className="relative flex-1">
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="course-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('courses.searchPlaceholder')}
                className="pl-10"
                maxLength={100}
              />
            </div>
            <Button type="submit">{t('common.search')}</Button>
          </form>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-category">{t('courses.category')}</Label>
              <Select
                id="f-category"
                value={filters.category}
                onChange={(e) => update('category', e.target.value)}
              >
                <option value="">{t('courses.allCategories')}</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-level">{t('courses.level')}</Label>
              <Select id="f-level" value={filters.level} onChange={(e) => update('level', e.target.value)}>
                <option value="">{t('courses.allLevels')}</option>
                {COURSE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {t(`levels.${l}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-price">{t('courses.price')}</Label>
              <Select id="f-price" value={filters.price} onChange={(e) => update('price', e.target.value)}>
                <option value="">{t('courses.anyPrice')}</option>
                <option value="free">{t('common.free')}</option>
                <option value="paid">{t('courses.paid')}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-reg">{t('courses.registration')}</Label>
              <Select
                id="f-reg"
                value={filters.registration}
                onChange={(e) => update('registration', e.target.value)}
              >
                <option value="">{t('courses.anyRegistration')}</option>
                <option value="open">{t('courses.open')}</option>
                <option value="closed">{t('courses.closed')}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-sort">{t('courses.sort')}</Label>
              <Select
                id="f-sort"
                value={filters.sort || 'newest'}
                onChange={(e) => update('sort', e.target.value === 'newest' ? '' : e.target.value)}
              >
                {COURSE_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(SORT_LABELS[s])}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="mb-5 flex min-h-9 items-center justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {courses.data && t('courses.results', { count: courses.data.meta.total })}
          </p>
          {hasFilters && (
            <Button variant="link" size="sm" onClick={() => setParams(new URLSearchParams())}>
              {t('common.clearFilters')}
            </Button>
          )}
        </div>

        {courses.isPending ? (
          <CourseGridSkeleton count={6} />
        ) : courses.isError ? (
          <ErrorState onRetry={() => void courses.refetch()} />
        ) : courses.data.data.length === 0 ? (
          <EmptyState title={hasFilters ? t('courses.emptyFiltered') : t('courses.empty')} />
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.data.data.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={courses.data.meta.totalPages}
              onChange={(p) => update('page', String(p))}
            />
          </>
        )}
      </div>
    </>
  );
}
