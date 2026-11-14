import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import {
  COURSE_LEVELS,
  DEFAULT_TIMEZONE,
  PUBLICATION_STATUSES,
  SUPPORTED_CURRENCIES,
  WEEKDAYS,
  type AdminCourseDto,
  type AdminUserRow,
  type CategoryDto,
} from '@alifya/shared';
import { DashboardPageHeader } from '@/components/layout/DashboardLayout';
import {
  BackLink,
  EmptyState,
  ErrorState,
  FormField,
  Pagination,
  StatusBadge,
  useConfirm,
} from '@/components/shared';
import { DataTable, TableSkeleton } from '@/components/shared/DataTable';
import { useToast } from '@/components/shared/toast';
import { Button } from '@/components/ui/button';
import { AlertMessage, Badge } from '@/components/ui/feedback';
import { Checkbox, Input, Label, Select, Textarea } from '@/components/ui/form-controls';
import { applyServerErrors } from '@/features/auth/AuthCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { apiGet, apiGetPaged, apiPatch, apiPost, normalizeError } from '@/lib/api';
import { formatDate, formatMoney, toDateInputValue, zonedDateToIso } from '@/lib/format';
import { usePageMeta } from '@/lib/seo';

/* ============================== List ============================== */
export function AdminCoursesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? '';
  const [q, setQ] = useState(params.get('q') ?? '');
  usePageMeta({ title: t('admin.courses'), noindex: true });

  const list = useQuery({
    queryKey: ['admin', 'courses', { page, status, q: params.get('q') ?? '' }],
    queryFn: () =>
      apiGetPaged<AdminCourseDto[]>('/admin/courses', {
        page,
        status: status || undefined,
        q: params.get('q') || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'unpublish' | 'archive' }) =>
      apiPost<AdminCourseDto>(`/admin/courses/${id}/${action}`),
    onSuccess: () => {
      toast(t('admin.saved'));
      void qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
      void qc.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (err) =>
      toast(Object.values(normalizeError(err).fields)[0] ?? normalizeError(err).message, 'danger'),
  });

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <>
      {dialog}
      <DashboardPageHeader
        title={t('admin.courses')}
        actions={
          can('courses.create') && (
            <Button asChild>
              <Link to="/admin/courses/new">
                <FontAwesomeIcon icon={faPlus} aria-hidden /> {t('admin.newCourse')}
              </Link>
            </Button>
          )
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <form
          className="flex flex-1 gap-2"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setParam('q', q.trim());
          }}
        >
          <label htmlFor="admin-course-q" className="sr-only">
            {t('common.search')}
          </label>
          <Input
            id="admin-course-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('courses.searchPlaceholder')}
          />
          <Button type="submit" variant="secondary">
            {t('common.search')}
          </Button>
        </form>
        <label htmlFor="admin-course-status" className="sr-only">
          {t('admin.status')}
        </label>
        <Select
          id="admin-course-status"
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          className="sm:w-48"
        >
          <option value="">{t('courses.anyRegistration')}</option>
          {PUBLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </Select>
      </div>

      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title={t('admin.noCourses')} />
      ) : (
        <>
          <DataTable
            caption={t('admin.courses')}
            rows={list.data.data}
            rowKey={(c) => c.id}
            columns={[
              {
                key: 'title',
                header: t('admin.name'),
                cell: (c) => (
                  <div className="min-w-0">
                    <Link
                      to={`/admin/courses/${c.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {c.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.category?.name ?? '—'}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: t('admin.status'),
                cell: (c) => (
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge
                      status={c.publicationStatus === 'published' ? c.displayStatus : c.publicationStatus}
                    />
                    {c.featured && <Badge tone="accent">★</Badge>}
                  </div>
                ),
              },
              {
                key: 'fee',
                header: t('courses.fee'),
                hideBelow: 'md',
                cell: (c) =>
                  c.isFree ? t('common.free') : formatMoney(c.feeAmount, c.currency, i18n.language),
              },
              {
                key: 'updated',
                header: t('admin.updated'),
                hideBelow: 'lg',
                cell: (c) => formatDate(c.updatedAt, i18n.language),
              },
              {
                key: 'actions',
                header: t('common.actions'),
                className: 'text-right',
                cell: (c) => (
                  <div className="flex justify-end gap-1.5">
                    {can('courses.publish') && c.publicationStatus === 'draft' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={transition.isPending}
                        onClick={() => transition.mutate({ id: c.id, action: 'publish' })}
                      >
                        {t('admin.publish')}
                      </Button>
                    )}
                    {can('courses.publish') && c.publicationStatus === 'published' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={transition.isPending}
                        onClick={() => transition.mutate({ id: c.id, action: 'unpublish' })}
                      >
                        {t('admin.unpublish')}
                      </Button>
                    )}
                    {can('courses.archive') && c.publicationStatus !== 'archived' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        disabled={transition.isPending}
                        onClick={async () => {
                          if (
                            await confirm(
                              t('admin.archive'),
                              t('admin.archiveConfirm', { title: c.title }),
                              true,
                            )
                          )
                            transition.mutate({ id: c.id, action: 'archive' });
                        }}
                      >
                        {t('admin.archive')}
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            page={page}
            totalPages={list.data.meta.totalPages}
            onChange={(p) => setParam('page', String(p))}
          />
        </>
      )}
    </>
  );
}

/* ============================== Form ============================== */
interface CourseFormValues {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  thumbnailUrl: string;
  categoryId: string;
  instructorIds: string[];
  feeAmount: string; // major units in the form; converted to minor units on submit
  currency: string;
  durationText: string;
  startDate: string;
  endDate: string;
  timezone: string;
  level: string;
  language: string;
  learningObjectives: string;
  entryRequirements: string;
  capacity: string;
  registrationMode: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  lifecycleOverride: string;
  featured: boolean;
  schedule: { day: string; startTime: string; endTime: string }[];
}

function toFormValues(c?: AdminCourseDto): CourseFormValues {
  const tz = c?.timezone ?? DEFAULT_TIMEZONE;
  return {
    title: c?.title ?? '',
    slug: c?.slug ?? '',
    subtitle: c?.subtitle ?? '',
    description: c?.description ?? '',
    thumbnailUrl: c?.thumbnailUrl ?? '',
    categoryId: c?.categoryId ?? '',
    instructorIds: c?.instructorIds ?? [],
    feeAmount: c ? (c.feeAmount / 100).toString() : '0',
    currency: c?.currency ?? 'USD',
    durationText: c?.durationText ?? '',
    startDate: toDateInputValue(c?.startDate, tz),
    endDate: toDateInputValue(c?.endDate, tz),
    timezone: tz,
    level: c?.level ?? 'all_levels',
    language: c?.language ?? 'en',
    learningObjectives: c?.learningObjectives.join('\n') ?? '',
    entryRequirements: c?.entryRequirements.join('\n') ?? '',
    capacity: c?.capacity?.toString() ?? '',
    registrationMode: c?.registrationMode ?? 'closed',
    registrationOpensAt: toDateInputValue(c?.registrationOpensAt, tz),
    registrationClosesAt: toDateInputValue(c?.registrationClosesAt, tz),
    lifecycleOverride: c?.lifecycleOverride ?? '',
    featured: c?.featured ?? false,
    schedule: c?.schedule ?? [],
  };
}

function toPayload(v: CourseFormValues) {
  const lines = (s: string) =>
    s
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  const date = (s: string) => (s ? zonedDateToIso(s, v.timezone) : null);
  const fee = Number(v.feeAmount);
  return {
    title: v.title,
    ...(v.slug ? { slug: v.slug } : {}),
    subtitle: v.subtitle,
    description: v.description,
    thumbnailUrl: v.thumbnailUrl || null,
    categoryId: v.categoryId || null,
    instructorIds: v.instructorIds,
    feeAmount: Number.isFinite(fee) ? Math.round(fee * 100) : NaN,
    currency: v.currency,
    durationText: v.durationText,
    startDate: date(v.startDate),
    endDate: date(v.endDate),
    timezone: v.timezone,
    level: v.level,
    language: v.language,
    learningObjectives: lines(v.learningObjectives),
    entryRequirements: lines(v.entryRequirements),
    capacity: v.capacity ? Number(v.capacity) : null,
    registrationMode: v.registrationMode,
    registrationOpensAt: date(v.registrationOpensAt),
    registrationClosesAt: date(v.registrationClosesAt),
    lifecycleOverride: v.lifecycleOverride || null,
    featured: v.featured,
    schedule: v.schedule,
  };
}

export function AdminCourseFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const { t } = useTranslation();
  usePageMeta({ title: isNew ? t('admin.newCourse') : t('admin.editCourse'), noindex: true });
  const course = useQuery({
    queryKey: ['admin', 'course', id],
    queryFn: () => apiGet<AdminCourseDto>(`/admin/courses/${id}`),
    enabled: !isNew,
  });

  if (!isNew && course.isPending) return <TableSkeleton rows={8} />;
  if (!isNew && course.isError) return <ErrorState onRetry={() => void course.refetch()} />;
  return <CourseForm key={course.data?.updatedAt ?? 'new'} course={course.data} />;
}

function CourseForm({ course }: { course?: AdminCourseDto }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [banner, setBanner] = useState<string | null>(null);
  const form = useForm<CourseFormValues>({ defaultValues: toFormValues(course) });
  const schedule = useFieldArray({ control: form.control, name: 'schedule' });
  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => apiGet<CategoryDto[]>('/admin/categories'),
  });
  const instructors = useQuery({
    queryKey: ['admin', 'users', 'instructors'],
    queryFn: () =>
      apiGetPaged<AdminUserRow[]>('/admin/users', { role: 'instructor', status: 'active', limit: 100 }),
    enabled: can('users.read'),
  });
  const archived = course?.publicationStatus === 'archived';
  const e = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    setBanner(null);
    try {
      const payload = toPayload(values);
      const saved = course
        ? await apiPatch<AdminCourseDto>(`/admin/courses/${course.id}`, payload)
        : await apiPost<AdminCourseDto>('/admin/courses', payload);
      void qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
      void qc.invalidateQueries({ queryKey: ['courses'] });
      qc.setQueryData(['admin', 'course', saved.id], saved);
      toast(t('admin.saved'));
      if (!course) navigate(`/admin/courses/${saved.id}`, { replace: true });
    } catch (err) {
      setBanner(applyServerErrors(err, form.setError).message);
    }
  });

  return (
    <>
      <BackLink to="/admin/courses">{t('admin.courses')}</BackLink>
      <div className="mt-4">
        <DashboardPageHeader
          title={course ? course.title : t('admin.newCourse')}
          actions={
            course && (
              <StatusBadge
                status={
                  course.publicationStatus === 'published' ? course.displayStatus : course.publicationStatus
                }
              />
            )
          }
        />
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {banner && <AlertMessage tone="danger">{banner}</AlertMessage>}
        <fieldset disabled={archived} className="contents">
          <Section title={t('courses.about')}>
            <FormField label="Title" error={e.title?.message}>
              <Input {...form.register('title', { required: 'Title is required' })} />
            </FormField>
            <FormField
              label="URL slug"
              hint="Leave empty to generate from the title."
              error={e.slug?.message}
            >
              <Input {...form.register('slug')} placeholder="introduction-to-data-science" />
            </FormField>
            <FormField label="Subtitle" error={e.subtitle?.message} className="md:col-span-2">
              <Input {...form.register('subtitle')} />
            </FormField>
            <FormField label="Description" error={e.description?.message} className="md:col-span-2">
              <Textarea rows={7} {...form.register('description')} />
            </FormField>
            <FormField label={t('courses.category')} error={e.categoryId?.message}>
              <Select {...form.register('categoryId')}>
                <option value="">—</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Thumbnail image URL"
              hint="Upload support arrives with the media module."
              error={e.thumbnailUrl?.message}
            >
              <Input type="url" {...form.register('thumbnailUrl')} placeholder="https://" />
            </FormField>
          </Section>

          <Section title={t('courses.instructor')}>
            <div className="md:col-span-2">
              {!can('users.read') ? (
                <p className="text-sm text-muted-foreground">
                  You need the users.read permission to assign instructors.
                </p>
              ) : instructors.data?.data.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {instructors.data.data.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 rounded-md border border-border p-3 text-sm"
                    >
                      <Checkbox value={u.id} {...form.register('instructorIds')} />
                      <span>
                        <span className="font-semibold">{u.fullName}</span>
                        <span className="block text-xs text-muted-foreground">{u.email}</span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active users hold the Instructor role yet. Assign the role from Users.
                </p>
              )}
              {e.instructorIds && (
                <p className="mt-1.5 text-xs font-medium text-danger">{e.instructorIds.message}</p>
              )}
            </div>
          </Section>

          <Section title="Fees, dates & capacity">
            <FormField label={`${t('courses.fee')} (0 = free)`} error={e.feeAmount?.message}>
              <Input type="number" min="0" step="0.01" inputMode="decimal" {...form.register('feeAmount')} />
            </FormField>
            <FormField label="Currency" error={e.currency?.message}>
              <Select {...form.register('currency')}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('courses.starts')} error={e.startDate?.message}>
              <Input type="date" {...form.register('startDate')} />
            </FormField>
            <FormField label={t('courses.ends')} error={e.endDate?.message}>
              <Input type="date" {...form.register('endDate')} />
            </FormField>
            <FormField label="Timezone (IANA)" error={e.timezone?.message}>
              <Input {...form.register('timezone')} />
            </FormField>
            <FormField label={t('courses.duration')} hint="e.g. 8 weeks" error={e.durationText?.message}>
              <Input {...form.register('durationText')} />
            </FormField>
            <FormField label={t('courses.level')}>
              <Select {...form.register('level')}>
                {COURSE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {t(`levels.${l}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('courses.language')}>
              <Select {...form.register('language')}>
                <option value="en">{t('languages.en')}</option>
                <option value="so">{t('languages.so')}</option>
              </Select>
            </FormField>
            <FormField label="Capacity (empty = unlimited)" error={e.capacity?.message}>
              <Input type="number" min="1" inputMode="numeric" {...form.register('capacity')} />
            </FormField>
          </Section>

          <Section title={t('courses.registration')}>
            <FormField label="Registration" error={e.registrationMode?.message}>
              <Select {...form.register('registrationMode')}>
                <option value="open">{t('courses.open')}</option>
                <option value="closed">{t('courses.closed')}</option>
              </Select>
            </FormField>
            <FormField
              label="Lifecycle override"
              hint="Normally derived from start/end dates."
              error={e.lifecycleOverride?.message}
            >
              <Select {...form.register('lifecycleOverride')}>
                <option value="">Automatic</option>
                <option value="in_progress">{t('status.in_progress')}</option>
                <option value="completed">{t('status.completed')}</option>
              </Select>
            </FormField>
            <FormField label="Registration opens" error={e.registrationOpensAt?.message}>
              <Input type="date" {...form.register('registrationOpensAt')} />
            </FormField>
            <FormField label="Registration closes" error={e.registrationClosesAt?.message}>
              <Input type="date" {...form.register('registrationClosesAt')} />
            </FormField>
            <label className="flex items-center gap-3 text-sm md:col-span-2">
              <Checkbox {...form.register('featured')} /> Feature on the homepage
            </label>
          </Section>

          <Section title={t('courses.objectives')}>
            <FormField label="Learning objectives (one per line)" error={e.learningObjectives?.message}>
              <Textarea rows={5} {...form.register('learningObjectives')} />
            </FormField>
            <FormField label="Entry requirements (one per line)" error={e.entryRequirements?.message}>
              <Textarea rows={5} {...form.register('entryRequirements')} />
            </FormField>
          </Section>

          <Section title={t('courses.schedule')}>
            <div className="flex flex-col gap-3 md:col-span-2">
              {schedule.fields.map((f, idx) => (
                <div
                  key={f.id}
                  className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-border p-3 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-end"
                >
                  <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                    <Label htmlFor={`sch-day-${idx}`}>Day</Label>
                    <Select id={`sch-day-${idx}`} {...form.register(`schedule.${idx}.day`)}>
                      {WEEKDAYS.map((d) => (
                        <option key={d} value={d}>
                          {t(`weekdays.${d}`)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`sch-start-${idx}`}>Start</Label>
                    <Input
                      id={`sch-start-${idx}`}
                      type="time"
                      {...form.register(`schedule.${idx}.startTime`)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`sch-end-${idx}`}>End</Label>
                    <Input id={`sch-end-${idx}`} type="time" {...form.register(`schedule.${idx}.endTime`)} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-danger"
                    onClick={() => schedule.remove(idx)}
                    aria-label="Remove session"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </Button>
                  {(e.schedule?.[idx]?.endTime || e.schedule?.[idx]?.startTime) && (
                    <p className="col-span-full text-xs font-medium text-danger">
                      {e.schedule?.[idx]?.endTime?.message ?? e.schedule?.[idx]?.startTime?.message}
                    </p>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => schedule.append({ day: 'saturday', startTime: '09:00', endTime: '11:00' })}
              >
                <FontAwesomeIcon icon={faPlus} aria-hidden /> Add weekly session
              </Button>
            </div>
          </Section>
        </fieldset>

        {!archived && (
          <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-ivory/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
            <Button type="button" variant="secondary" onClick={() => navigate('/admin/courses')}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        )}
      </form>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-background p-5 sm:p-6">
      <h2 className="mb-5 text-lg">{title}</h2>
      <div className="grid gap-5 md:grid-cols-2">{children}</div>
    </section>
  );
}
