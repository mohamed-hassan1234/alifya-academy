import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faEye, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { PUBLICATION_STATUSES, type AdminCourseDto, type AdminLearningPathDto } from '@alifya/shared';
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
import { AlertMessage } from '@/components/ui/feedback';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/form-controls';
import { applyServerErrors } from '@/features/auth/AuthCard';
import { apiGet, apiGetPaged, apiPatch, apiPost, normalizeError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { usePageMeta } from '@/lib/seo';

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/* ================================ List ================================ */
export function AdminLearningPathsPage() {
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? '';
  usePageMeta({ title: 'Learning roadmaps', noindex: true });
  const list = useQuery({
    queryKey: ['admin', 'learning-paths', { page, status }],
    queryFn: () =>
      apiGetPaged<AdminLearningPathDto[]>('/admin/learning-paths', { page, status: status || undefined }),
    placeholderData: keepPreviousData,
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiPost(`/admin/learning-paths/${id}/${action}`),
    onSuccess: () => {
      toast('Saved.');
      void qc.invalidateQueries({ queryKey: ['admin', 'learning-paths'] });
      void qc.invalidateQueries({ queryKey: ['learning-paths'] });
      void qc.invalidateQueries({ queryKey: ['learning-path'] });
    },
    onError: (err) =>
      toast(Object.values(normalizeError(err).fields)[0] ?? normalizeError(err).message, 'danger'),
  });

  return (
    <>
      {dialog}
      <DashboardPageHeader
        title="Learning roadmaps"
        description="Guided journeys made of ordered stages. Each stage groups existing courses; the public site draws them as a road."
        actions={
          <Button asChild>
            <Link to="/admin/learning-paths/new">
              <FontAwesomeIcon icon={faPlus} aria-hidden /> New roadmap
            </Link>
          </Button>
        }
      />
      <Select
        aria-label="Status"
        className="mb-5 sm:w-48"
        value={status}
        onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
      >
        <option value="">All statuses</option>
        {PUBLICATION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s[0]!.toUpperCase() + s.slice(1)}
          </option>
        ))}
      </Select>
      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          title="No roadmaps yet."
          description="Create a roadmap and add at least two stages to publish it."
        />
      ) : (
        <>
          <DataTable
            caption="Learning roadmaps"
            rows={list.data.data}
            rowKey={(p) => p.id}
            columns={[
              {
                key: 'title',
                header: 'Roadmap',
                cell: (p) => (
                  <Link
                    to={`/admin/learning-paths/${p.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {p.title}
                  </Link>
                ),
              },
              { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.publicationStatus} /> },
              { key: 'stages', header: 'Stages', hideBelow: 'sm', cell: (p) => p.stageCount },
              { key: 'courses', header: 'Courses', hideBelow: 'md', cell: (p) => p.courseCount },
              {
                key: 'updated',
                header: 'Updated',
                hideBelow: 'lg',
                cell: (p) => formatDate(p.updatedAt, i18n.language),
              },
              {
                key: 'actions',
                header: 'Actions',
                className: 'text-right',
                cell: (p) => (
                  <div className="flex justify-end gap-1">
                    {p.publicationStatus === 'published' && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/roadmaps/${p.slug}`} aria-label={`View ${p.title} on the website`}>
                          <FontAwesomeIcon icon={faEye} aria-hidden />
                        </Link>
                      </Button>
                    )}
                    {p.publicationStatus === 'draft' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => act.mutate({ id: p.id, action: 'publish' })}
                      >
                        Publish
                      </Button>
                    )}
                    {p.publicationStatus === 'published' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => act.mutate({ id: p.id, action: 'unpublish' })}
                      >
                        Unpublish
                      </Button>
                    )}
                    {p.publicationStatus !== 'archived' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        onClick={async () => {
                          if (
                            await confirm(
                              'Archive roadmap',
                              `Archive “${p.title}”? It will be hidden and can no longer be edited.`,
                              true,
                            )
                          )
                            act.mutate({ id: p.id, action: 'archive' });
                        }}
                      >
                        Archive
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
            onChange={(p) => setParams({ ...(status ? { status } : {}), page: String(p) })}
          />
        </>
      )}
    </>
  );
}

/* ================================ Editor ================================ */
interface StageForm {
  stageId: string;
  title: string;
  description: string;
  objectives: string;
  durationText: string;
  courseIds: string[];
}
interface PathForm {
  title: string;
  slug: string;
  summary: string;
  description: string;
  durationText: string;
  outcomes: string;
  displayOrder: string;
  stages: StageForm[];
}

const emptyStage = (): StageForm => ({
  stageId: '',
  title: '',
  description: '',
  objectives: '',
  durationText: '',
  courseIds: [],
});

export function AdminLearningPathFormPage() {
  const { id } = useParams();
  const path = useQuery({
    queryKey: ['admin', 'learning-path', id],
    queryFn: () => apiGet<AdminLearningPathDto>(`/admin/learning-paths/${id}`),
    enabled: !!id,
  });
  usePageMeta({ title: id ? 'Edit roadmap' : 'New roadmap', noindex: true });
  if (id && path.isPending) return <TableSkeleton rows={6} />;
  if (id && path.isError) return <ErrorState onRetry={() => void path.refetch()} />;
  return <PathEditor key={path.data?.updatedAt ?? 'new'} path={path.data} />;
}

function PathEditor({ path }: { path?: AdminLearningPathDto }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [banner, setBanner] = useState<string | null>(null);
  const courses = useQuery({
    queryKey: ['admin', 'courses', 'all'],
    queryFn: () => apiGetPaged<AdminCourseDto[]>('/admin/courses', { limit: 100 }),
  });
  const form = useForm<PathForm>({
    defaultValues: {
      title: path?.title ?? '',
      slug: path?.slug ?? '',
      summary: path?.summary ?? '',
      description: path?.description ?? '',
      durationText: path?.durationText ?? '',
      outcomes: path?.outcomes.join('\n') ?? '',
      displayOrder: String(path?.displayOrder ?? 0),
      stages: path?.stages.map((s) => ({
        stageId: s.id,
        title: s.title,
        description: s.description,
        objectives: s.objectives.join('\n'),
        durationText: s.durationText,
        courseIds: s.courseIds,
      })) ?? [emptyStage(), emptyStage()],
    },
  });
  const stages = useFieldArray({ control: form.control, name: 'stages' });
  const e = form.formState.errors;
  const archived = path?.publicationStatus === 'archived';
  const usable = courses.data?.data.filter((c) => c.publicationStatus !== 'archived') ?? [];

  const submit = form.handleSubmit(async (v) => {
    setBanner(null);
    const body = {
      title: v.title,
      ...(v.slug ? { slug: v.slug } : {}),
      summary: v.summary,
      description: v.description,
      durationText: v.durationText,
      outcomes: lines(v.outcomes),
      displayOrder: Number(v.displayOrder) || 0,
      stages: v.stages.map((s) => ({
        ...(s.stageId ? { id: s.stageId } : {}),
        title: s.title,
        description: s.description,
        objectives: lines(s.objectives),
        durationText: s.durationText,
        courseIds: s.courseIds,
      })),
    };
    try {
      const saved = path
        ? await apiPatch<AdminLearningPathDto>(`/admin/learning-paths/${path.id}`, body)
        : await apiPost<AdminLearningPathDto>('/admin/learning-paths', body);
      void qc.invalidateQueries({ queryKey: ['admin', 'learning-paths'] });
      void qc.invalidateQueries({ queryKey: ['learning-path'] });
      qc.setQueryData(['admin', 'learning-path', saved.id], saved);
      toast('Saved.');
      if (!path) navigate(`/admin/learning-paths/${saved.id}`, { replace: true });
    } catch (err) {
      setBanner(applyServerErrors(err, form.setError).message);
    }
  });

  return (
    <>
      <BackLink to="/admin/learning-paths">Learning roadmaps</BackLink>
      <div className="mt-4">
        <DashboardPageHeader
          title={path?.title ?? 'New roadmap'}
          actions={
            path && (
              <div className="flex items-center gap-2">
                <StatusBadge status={path.publicationStatus} />
                {path.publicationStatus === 'published' && (
                  <Button size="sm" variant="secondary" asChild>
                    <Link to={`/roadmaps/${path.slug}`}>
                      <FontAwesomeIcon icon={faEye} aria-hidden /> View on website
                    </Link>
                  </Button>
                )}
              </div>
            )
          }
        />
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        {banner && <AlertMessage tone="danger">{banner}</AlertMessage>}
        <fieldset disabled={archived} className="contents">
          <section className="grid gap-5 rounded-xl border border-border bg-background p-6 md:grid-cols-2">
            <h2 className="text-lg md:col-span-2">Roadmap details</h2>
            <FormField label="Title" error={e.title?.message}>
              <Input {...form.register('title')} />
            </FormField>
            <FormField
              label="URL slug"
              hint="Leave empty to generate from the title."
              error={e.slug?.message}
            >
              <Input {...form.register('slug')} />
            </FormField>
            <FormField label="Short summary" error={e.summary?.message} className="md:col-span-2">
              <Textarea rows={2} {...form.register('summary')} />
            </FormField>
            <FormField label="Introduction" error={e.description?.message} className="md:col-span-2">
              <Textarea rows={4} {...form.register('description')} />
            </FormField>
            <FormField label="Overall duration" hint="e.g. 9 months" error={e.durationText?.message}>
              <Input {...form.register('durationText')} />
            </FormField>
            <FormField label="Display order" error={e.displayOrder?.message}>
              <Input type="number" min="0" {...form.register('displayOrder')} />
            </FormField>
            <FormField label="Outcomes (one per line)" error={e.outcomes?.message} className="md:col-span-2">
              <Textarea rows={4} {...form.register('outcomes')} />
            </FormField>
          </section>

          <section className="rounded-xl border border-border bg-background p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg">Stages</h2>
                <p className="text-sm text-muted-foreground">
                  In order along the road. At least two stages are needed to publish.
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => stages.append(emptyStage())}>
                <FontAwesomeIcon icon={faPlus} aria-hidden /> Add stage
              </Button>
            </div>
            {e.stages?.message && <p className="mb-3 text-xs font-medium text-danger">{e.stages.message}</p>}
            <ol className="space-y-4">
              {stages.fields.map((f, i) => (
                <li key={f.id} className="rounded-lg border border-border bg-ivory p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-primary/70 bg-background text-sm font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold">Stage {i + 1}</span>
                    </span>
                    <span className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={i === 0}
                        onClick={() => stages.move(i, i - 1)}
                        aria-label={`Move stage ${i + 1} up`}
                      >
                        <FontAwesomeIcon icon={faArrowUp} />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={i === stages.fields.length - 1}
                        onClick={() => stages.move(i, i + 1)}
                        aria-label={`Move stage ${i + 1} down`}
                      >
                        <FontAwesomeIcon icon={faArrowDown} />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-danger"
                        onClick={() => stages.remove(i)}
                        aria-label={`Remove stage ${i + 1}`}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Stage title" error={e.stages?.[i]?.title?.message}>
                      <Input {...form.register(`stages.${i}.title`)} />
                    </FormField>
                    <FormField
                      label="Duration"
                      hint="e.g. 4 weeks"
                      error={e.stages?.[i]?.durationText?.message}
                    >
                      <Input {...form.register(`stages.${i}.durationText`)} />
                    </FormField>
                    <FormField
                      label="Description"
                      className="md:col-span-2"
                      error={e.stages?.[i]?.description?.message}
                    >
                      <Textarea rows={3} {...form.register(`stages.${i}.description`)} />
                    </FormField>
                    <FormField
                      label="Learning objectives (one per line)"
                      className="md:col-span-2"
                      error={e.stages?.[i]?.objectives?.message}
                    >
                      <Textarea rows={3} {...form.register(`stages.${i}.objectives`)} />
                    </FormField>
                    <fieldset className="md:col-span-2">
                      <legend className="mb-2 text-sm font-semibold">Courses in this stage</legend>
                      {courses.isPending ? (
                        <TableSkeleton rows={2} />
                      ) : usable.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No courses available yet.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {usable.map((c) => (
                            <label
                              key={c.id}
                              className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm"
                            >
                              <Checkbox value={c.id} {...form.register(`stages.${i}.courseIds`)} />
                              <span>
                                <span className="font-semibold">{c.title}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {c.publicationStatus === 'published'
                                    ? 'Published'
                                    : 'Draft — hidden publicly until published'}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>
                  </div>
                </li>
              ))}
            </ol>
            {stages.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">No stages yet — add the first one.</p>
            )}
          </section>
        </fieldset>
        {!archived && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/admin/learning-paths')}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Save roadmap
            </Button>
          </div>
        )}
      </form>
    </>
  );
}
