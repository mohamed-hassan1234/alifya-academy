import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPlus } from '@fortawesome/free-solid-svg-icons';
import {
  PUBLICATION_STATUSES,
  type AdminCourseDto,
  type AdminInstructorDto,
  type AdminProgramDto,
  type ContactMessageDto,
  type InstructorProfileInput,
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
import { ImageUploader } from '@/components/shared/Uploaders';
import { useToast } from '@/components/shared/toast';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { AlertMessage, Badge } from '@/components/ui/feedback';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/form-controls';
import { applyServerErrors } from '@/features/auth/AuthCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { apiGet, apiGetPaged, apiPatch, apiPost, apiPut, normalizeError } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { usePageMeta } from '@/lib/seo';

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/* ================================ Programs ================================ */
export function AdminProgramsPage() {
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? '';
  usePageMeta({ title: 'Programs', noindex: true });
  const list = useQuery({
    queryKey: ['admin', 'programs', { page, status }],
    queryFn: () => apiGetPaged<AdminProgramDto[]>('/admin/programs', { page, status: status || undefined }),
    placeholderData: keepPreviousData,
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiPost(`/admin/programs/${id}/${action}`),
    onSuccess: () => {
      toast('Saved.');
      void qc.invalidateQueries({ queryKey: ['admin', 'programs'] });
      void qc.invalidateQueries({ queryKey: ['programs'] });
    },
    onError: (err) =>
      toast(Object.values(normalizeError(err).fields)[0] ?? normalizeError(err).message, 'danger'),
  });

  return (
    <>
      {dialog}
      <DashboardPageHeader
        title="Programs"
        description="Academic programs group related courses into a pathway."
        actions={
          <Button asChild>
            <Link to="/admin/programs/new">
              <FontAwesomeIcon icon={faPlus} aria-hidden /> New program
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
        <EmptyState title="No programs yet." description="Create a program to group related courses." />
      ) : (
        <>
          <DataTable
            caption="Programs"
            rows={list.data.data}
            rowKey={(p) => p.id}
            columns={[
              {
                key: 'title',
                header: 'Program',
                cell: (p) => (
                  <Link to={`/admin/programs/${p.id}`} className="font-semibold text-primary hover:underline">
                    {p.title}
                  </Link>
                ),
              },
              { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.publicationStatus} /> },
              { key: 'courses', header: 'Courses', hideBelow: 'sm', cell: (p) => p.courseIds.length },
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
                              'Archive program',
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

interface ProgramForm {
  title: string;
  slug: string;
  summary: string;
  description: string;
  imageUrl: string;
  durationText: string;
  objectives: string;
  entryRequirements: string;
  courseIds: string[];
  displayOrder: string;
}

export function AdminProgramFormPage() {
  const { id } = useParams();
  const program = useQuery({
    queryKey: ['admin', 'program', id],
    queryFn: () => apiGet<AdminProgramDto>(`/admin/programs/${id}`),
    enabled: !!id,
  });
  usePageMeta({ title: id ? 'Edit program' : 'New program', noindex: true });
  if (id && program.isPending) return <TableSkeleton rows={6} />;
  if (id && program.isError) return <ErrorState onRetry={() => void program.refetch()} />;
  return <ProgramEditor key={program.data?.updatedAt ?? 'new'} program={program.data} />;
}

function ProgramEditor({ program }: { program?: AdminProgramDto }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [banner, setBanner] = useState<string | null>(null);
  const courses = useQuery({
    queryKey: ['admin', 'courses', 'all'],
    queryFn: () => apiGetPaged<AdminCourseDto[]>('/admin/courses', { limit: 100 }),
  });
  const form = useForm<ProgramForm>({
    defaultValues: {
      title: program?.title ?? '',
      slug: program?.slug ?? '',
      summary: program?.summary ?? '',
      description: program?.description ?? '',
      imageUrl: program?.imageUrl ?? '',
      durationText: program?.durationText ?? '',
      objectives: program?.objectives.join('\n') ?? '',
      entryRequirements: program?.entryRequirements.join('\n') ?? '',
      courseIds: program?.courseIds ?? [],
      displayOrder: String(program?.displayOrder ?? 0),
    },
  });
  const e = form.formState.errors;
  const archived = program?.publicationStatus === 'archived';

  const submit = form.handleSubmit(async (v) => {
    setBanner(null);
    const body = {
      title: v.title,
      ...(v.slug ? { slug: v.slug } : {}),
      summary: v.summary,
      description: v.description,
      imageUrl: v.imageUrl || null,
      durationText: v.durationText,
      objectives: lines(v.objectives),
      entryRequirements: lines(v.entryRequirements),
      courseIds: v.courseIds,
      displayOrder: Number(v.displayOrder) || 0,
    };
    try {
      const saved = program
        ? await apiPatch<AdminProgramDto>(`/admin/programs/${program.id}`, body)
        : await apiPost<AdminProgramDto>('/admin/programs', body);
      void qc.invalidateQueries({ queryKey: ['admin', 'programs'] });
      qc.setQueryData(['admin', 'program', saved.id], saved);
      toast('Saved.');
      if (!program) navigate(`/admin/programs/${saved.id}`, { replace: true });
    } catch (err) {
      setBanner(applyServerErrors(err, form.setError).message);
    }
  });

  return (
    <>
      <BackLink to="/admin/programs">Programs</BackLink>
      <div className="mt-4">
        <DashboardPageHeader
          title={program?.title ?? 'New program'}
          actions={program && <StatusBadge status={program.publicationStatus} />}
        />
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        {banner && <AlertMessage tone="danger">{banner}</AlertMessage>}
        <fieldset disabled={archived} className="contents">
          <section className="grid gap-5 rounded-lg border border-border bg-background p-6 md:grid-cols-2">
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
            <FormField label="Description" error={e.description?.message} className="md:col-span-2">
              <Textarea rows={6} {...form.register('description')} />
            </FormField>
            <FormField label="Duration" hint="e.g. 9 months" error={e.durationText?.message}>
              <Input {...form.register('durationText')} />
            </FormField>
            <FormField label="Display order" error={e.displayOrder?.message}>
              <Input type="number" min="0" {...form.register('displayOrder')} />
            </FormField>
            <div className="md:col-span-2">
              <Controller
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <ImageUploader
                    label="Program image"
                    purpose="program_image"
                    value={field.value || null}
                    onChange={(u) => field.onChange(u ?? '')}
                    error={e.imageUrl?.message}
                  />
                )}
              />
            </div>
            <FormField label="Objectives (one per line)" error={e.objectives?.message}>
              <Textarea rows={5} {...form.register('objectives')} />
            </FormField>
            <FormField label="Eligibility requirements (one per line)" error={e.entryRequirements?.message}>
              <Textarea rows={5} {...form.register('entryRequirements')} />
            </FormField>
          </section>
          <section className="rounded-lg border border-border bg-background p-6">
            <h2 className="mb-4 text-lg">Courses in this program</h2>
            {courses.isPending ? (
              <TableSkeleton rows={3} />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {courses.data?.data
                  .filter((c) => c.publicationStatus !== 'archived')
                  .map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 rounded-md border border-border p-3 text-sm"
                    >
                      <Checkbox value={c.id} {...form.register('courseIds')} />
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
            {e.courseIds && <p className="mt-2 text-xs font-medium text-danger">{e.courseIds.message}</p>}
          </section>
        </fieldset>
        {!archived && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/admin/programs')}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Save program
            </Button>
          </div>
        )}
      </form>
    </>
  );
}

/* ================================ Instructors ================================ */
export function AdminInstructorsPage() {
  const { can } = useAuth();
  const [editing, setEditing] = useState<AdminInstructorDto | null>(null);
  usePageMeta({ title: 'Instructors', noindex: true });
  const list = useQuery({
    queryKey: ['admin', 'instructors'],
    queryFn: () => apiGetPaged<AdminInstructorDto[]>('/admin/instructors'),
  });
  return (
    <>
      <DashboardPageHeader
        title="Instructors"
        description="Users holding the Instructor role. Assign the role from Users; publish a profile here to show it on the website."
      />
      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          title="No instructors yet."
          description="Give a user the Instructor role from the Users page."
        />
      ) : (
        <DataTable
          caption="Instructors"
          rows={list.data.data}
          rowKey={(i) => i.id}
          columns={[
            {
              key: 'name',
              header: 'Instructor',
              cell: (i) => (
                <div className="flex items-center gap-3">
                  {i.photoUrl ? (
                    <img src={i.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-mint text-xs font-bold text-primary">
                      {i.fullName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="font-semibold">{i.fullName}</p>
                    <p className="text-xs text-muted-foreground">{i.professionalTitle || i.email}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Account',
              hideBelow: 'sm',
              cell: (i) => <StatusBadge status={i.status} />,
            },
            {
              key: 'public',
              header: 'Website',
              cell: (i) => (
                <Badge tone={i.isPublic ? 'success' : 'neutral'}>{i.isPublic ? 'Public' : 'Hidden'}</Badge>
              ),
            },
            {
              key: 'courses',
              header: 'Assigned courses',
              hideBelow: 'md',
              cell: (i) =>
                i.assignedCourses.length ? i.assignedCourses.map((c) => c.title).join(', ') : '—',
            },
            {
              key: 'edit',
              header: 'Actions',
              className: 'text-right',
              cell: (i) =>
                can('instructors.manage') ? (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>
                    <FontAwesomeIcon icon={faPen} aria-hidden /> Edit profile
                  </Button>
                ) : null,
            },
          ]}
        />
      )}
      {editing && (
        <Modal
          open
          onOpenChange={(o) => !o && setEditing(null)}
          title={`Profile — ${editing.fullName}`}
          className="max-w-2xl"
        >
          <InstructorProfileForm
            endpoint={`/admin/instructors/${editing.id}/profile`}
            initial={editing}
            onSaved={() => setEditing(null)}
          />
        </Modal>
      )}
    </>
  );
}

/** Shared by the admin editor and the instructor's own profile page. */
export function InstructorProfileForm({
  endpoint,
  initial,
  onSaved,
}: {
  endpoint: string;
  initial: AdminInstructorDto;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [banner, setBanner] = useState<string | null>(null);
  const form = useForm<InstructorProfileInput & { social: Record<string, string> }>({
    defaultValues: {
      professionalTitle: initial.professionalTitle,
      specialization: initial.specialization,
      biography: initial.biography,
      photoUrl: initial.photoUrl,
      isPublic: initial.isPublic,
      social: {
        linkedin: initial.social.linkedin ?? '',
        x: initial.social.x ?? '',
        website: initial.social.website ?? '',
        facebook: initial.social.facebook ?? '',
      },
    },
  });
  const e = form.formState.errors;
  const submit = form.handleSubmit(async (v) => {
    setBanner(null);
    try {
      const social = Object.fromEntries(
        Object.entries(v.social ?? {}).map(([k, val]) => [k, val?.trim() ? val.trim() : null]),
      );
      await apiPut(endpoint, { ...v, photoUrl: v.photoUrl || null, social });
      void qc.invalidateQueries({ queryKey: ['admin', 'instructors'] });
      void qc.invalidateQueries({ queryKey: ['instructor-self'] });
      void qc.invalidateQueries({ queryKey: ['instructors'] });
      toast('Profile saved.');
      onSaved?.();
    } catch (err) {
      setBanner(applyServerErrors(err, form.setError).message);
    }
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {banner && <AlertMessage tone="danger">{banner}</AlertMessage>}
      <Controller
        control={form.control}
        name="photoUrl"
        render={({ field }) => (
          <ImageUploader
            label="Profile photograph"
            purpose="instructor_photo"
            aspect="4/5"
            value={field.value ?? null}
            onChange={(u) => field.onChange(u)}
            error={e.photoUrl?.message}
          />
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Professional title" error={e.professionalTitle?.message}>
          <Input {...form.register('professionalTitle')} placeholder="e.g. Senior Lecturer" />
        </FormField>
        <FormField label="Specialization" error={e.specialization?.message}>
          <Input {...form.register('specialization')} />
        </FormField>
      </div>
      <FormField label="Biography" error={e.biography?.message}>
        <Textarea rows={6} {...form.register('biography')} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        {(['linkedin', 'x', 'website', 'facebook'] as const).map((k) => (
          <FormField
            key={k}
            label={k === 'x' ? 'X (Twitter)' : k[0]!.toUpperCase() + k.slice(1)}
            error={(e.social as Record<string, { message?: string }> | undefined)?.[k]?.message}
          >
            <Input type="url" placeholder="https://" {...form.register(`social.${k}`)} />
          </FormField>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <Checkbox {...form.register('isPublic')} /> Show this profile on the public website
      </label>
      <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
        Save profile
      </Button>
    </form>
  );
}

/* ================================ Contact messages ================================ */
export function AdminContactMessagesPage() {
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? '';
  const [open, setOpen] = useState<ContactMessageDto | null>(null);
  usePageMeta({ title: 'Contact messages', noindex: true });
  const list = useQuery({
    queryKey: ['admin', 'contact', { page, status }],
    queryFn: () =>
      apiGetPaged<ContactMessageDto[]>('/admin/contact-messages', { page, status: status || undefined }),
    placeholderData: keepPreviousData,
  });
  const setStatus = useMutation({
    mutationFn: ({ id, s }: { id: string; s: string }) =>
      apiPatch<ContactMessageDto>(`/admin/contact-messages/${id}`, { status: s }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'contact'] }),
    onError: (err) => toast(normalizeError(err).message, 'danger'),
  });
  return (
    <>
      <DashboardPageHeader
        title="Contact messages"
        description="Messages sent through the website contact form."
      />
      <Select
        aria-label="Status"
        className="mb-5 sm:w-48"
        value={status}
        onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
      >
        <option value="">Open (new + read)</option>
        <option value="new">New</option>
        <option value="read">Read</option>
        <option value="archived">Archived</option>
      </Select>
      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="No messages." />
      ) : (
        <>
          <DataTable
            caption="Contact messages"
            rows={list.data.data}
            rowKey={(m) => m.id}
            columns={[
              {
                key: 'from',
                header: 'From',
                cell: (m) => (
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => {
                      setOpen(m);
                      if (m.status === 'new') setStatus.mutate({ id: m.id, s: 'read' });
                    }}
                  >
                    <span className="block font-semibold text-primary hover:underline">{m.subject}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.name} · {m.email}
                    </span>
                  </button>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                cell: (m) => <Badge tone={m.status === 'new' ? 'accent' : 'neutral'}>{m.status}</Badge>,
              },
              {
                key: 'date',
                header: 'Received',
                hideBelow: 'md',
                cell: (m) => formatDateTime(m.createdAt, i18n.language),
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
      {open && (
        <Modal
          open
          onOpenChange={(o) => !o && setOpen(null)}
          title={open.subject}
          description={`${open.name} · ${open.email}${open.phone ? ` · ${open.phone}` : ''}`}
          footer={
            <>
              <Button variant="secondary" asChild>
                <a href={`mailto:${open.email}?subject=${encodeURIComponent(`Re: ${open.subject}`)}`}>
                  Reply by email
                </a>
              </Button>
              {open.status !== 'archived' && (
                <Button
                  onClick={() => {
                    setStatus.mutate({ id: open.id, s: 'archived' });
                    setOpen(null);
                  }}
                >
                  Archive
                </Button>
              )}
            </>
          }
        >
          <p className="whitespace-pre-line text-sm leading-relaxed">{open.message}</p>
        </Modal>
      )}
    </>
  );
}
