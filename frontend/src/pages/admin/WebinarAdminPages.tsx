import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faLock, faPlus, faTrash, faUsers } from '@fortawesome/free-solid-svg-icons';
import {
  PUBLICATION_STATUSES,
  WEBINAR_PLATFORMS,
  type AdminWebinarDto,
  type WebinarPlatform,
  type WebinarRegistrationDto,
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
import { AlertMessage } from '@/components/ui/feedback';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/form-controls';
import { applyServerErrors } from '@/features/auth/AuthCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { WebinarStatusBadge } from '@/features/webinars/WebinarVisuals';
import { apiGet, apiGetPaged, apiPatch, apiPost, normalizeError } from '@/lib/api';
import { formatDateTime, toDateTimeLocal } from '@/lib/format';
import { usePageMeta } from '@/lib/seo';

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
const TIMEZONES = [
  'Africa/Mogadishu',
  'Africa/Nairobi',
  'Africa/Addis_Ababa',
  'Europe/London',
  'UTC',
  'America/New_York',
];

/* ================================ List ================================ */
export function AdminWebinarsPage() {
  const { i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? '';
  usePageMeta({ title: 'Webinars', noindex: true });
  const list = useQuery({
    queryKey: ['admin', 'webinars', { page, status }],
    queryFn: () => apiGetPaged<AdminWebinarDto[]>('/admin/webinars', { page, status: status || undefined }),
    placeholderData: keepPreviousData,
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiPost(`/admin/webinars/${id}/${action}`),
    onSuccess: () => {
      toast('Saved.');
      void qc.invalidateQueries({ queryKey: ['admin', 'webinars'] });
      void qc.invalidateQueries({ queryKey: ['webinars'] });
      void qc.invalidateQueries({ queryKey: ['webinar'] });
    },
    onError: (err) =>
      toast(Object.values(normalizeError(err).fields)[0] ?? normalizeError(err).message, 'danger'),
  });

  return (
    <>
      {dialog}
      <DashboardPageHeader
        title="Webinars"
        description="Live online sessions. Meeting links stay private: only registered participants see them, and only when joining opens."
        actions={
          can('webinars.create') && (
            <Button asChild>
              <Link to="/admin/webinars/new">
                <FontAwesomeIcon icon={faPlus} aria-hidden /> New webinar
              </Link>
            </Button>
          )
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
          title="No webinars yet."
          description="Create a webinar, add a speaker and a description, then publish it."
        />
      ) : (
        <>
          <DataTable
            caption="Webinars"
            rows={list.data.data}
            rowKey={(w) => w.id}
            columns={[
              {
                key: 'title',
                header: 'Webinar',
                cell: (w) => (
                  <div className="flex items-center gap-3">
                    {w.posterUrl ? (
                      <img src={w.posterUrl} alt="" className="h-12 w-10 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="h-12 w-10 shrink-0 rounded bg-brand" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <Link
                        to={`/admin/webinars/${w.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {w.title}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(w.startsAt, i18n.language, w.timezone)}
                      </span>
                    </span>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                cell: (w) => (
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge
                      status={
                        w.publicationStatus === 'published' ? 'published' : (w.publicationStatus as 'draft')
                      }
                    />
                    <WebinarStatusBadge status={w.status} />
                  </div>
                ),
              },
              {
                key: 'registrations',
                header: 'Registered',
                hideBelow: 'sm',
                cell: (w) =>
                  can('webinar_registrations.manage') ? (
                    <Link
                      to={`/admin/webinars/${w.id}/registrations`}
                      className="inline-flex items-center gap-2 text-primary hover:underline"
                    >
                      <FontAwesomeIcon icon={faUsers} aria-hidden /> {w.registeredCount}
                      {w.capacity ? ` / ${w.capacity}` : ''}
                    </Link>
                  ) : (
                    `${w.registeredCount}${w.capacity ? ` / ${w.capacity}` : ''}`
                  ),
              },
              {
                key: 'actions',
                header: 'Actions',
                className: 'text-right',
                cell: (w) => (
                  <div className="flex justify-end gap-1">
                    {w.publicationStatus === 'published' && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/webinars/${w.slug}`} aria-label={`View ${w.title} on the website`}>
                          <FontAwesomeIcon icon={faEye} aria-hidden />
                        </Link>
                      </Button>
                    )}
                    {can('webinars.publish') && w.publicationStatus === 'draft' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => act.mutate({ id: w.id, action: 'publish' })}
                      >
                        Publish
                      </Button>
                    )}
                    {can('webinars.publish') && w.publicationStatus === 'published' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => act.mutate({ id: w.id, action: 'unpublish' })}
                      >
                        Unpublish
                      </Button>
                    )}
                    {can('webinars.cancel') && !w.cancelledAt && w.status !== 'completed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        onClick={async () => {
                          if (
                            await confirm(
                              'Cancel webinar',
                              `Cancel “${w.title}”? Registration closes and the page shows it as cancelled.`,
                              true,
                            )
                          )
                            act.mutate({ id: w.id, action: 'cancel' });
                        }}
                      >
                        Cancel
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
interface SpeakerForm {
  name: string;
  title: string;
  organization: string;
  bio: string;
  photoUrl: string;
}
interface WebinarForm {
  title: string;
  slug: string;
  subtitle: string;
  summary: string;
  description: string;
  topic: string;
  posterUrl: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  platform: WebinarPlatform;
  venue: string;
  capacity: string;
  registrationOpen: boolean;
  meetingUrl: string;
  meetingPasscode: string;
  joinOpensMinutesBefore: string;
  recordingUrl: string;
  featured: boolean;
  agenda: string;
  speakers: SpeakerForm[];
}

export function AdminWebinarFormPage() {
  const { id } = useParams();
  const webinar = useQuery({
    queryKey: ['admin', 'webinar', id],
    queryFn: () => apiGet<AdminWebinarDto>(`/admin/webinars/${id}`),
    enabled: !!id,
  });
  usePageMeta({ title: id ? 'Edit webinar' : 'New webinar', noindex: true });
  if (id && webinar.isPending) return <TableSkeleton rows={6} />;
  if (id && webinar.isError) return <ErrorState onRetry={() => void webinar.refetch()} />;
  return <WebinarEditor key={webinar.data?.updatedAt ?? 'new'} webinar={webinar.data} />;
}

const platformLabel = (p: WebinarPlatform) =>
  ({
    zoom: 'Zoom',
    google_meet: 'Google Meet',
    microsoft_teams: 'Microsoft Teams',
    youtube_live: 'YouTube Live',
    in_person: 'In person',
    other: 'Other',
  })[p];

function WebinarEditor({ webinar }: { webinar?: AdminWebinarDto }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const [banner, setBanner] = useState<string | null>(null);
  const form = useForm<WebinarForm>({
    defaultValues: {
      title: webinar?.title ?? '',
      slug: webinar?.slug ?? '',
      subtitle: webinar?.subtitle ?? '',
      summary: webinar?.summary ?? '',
      description: webinar?.description ?? '',
      topic: webinar?.topic ?? '',
      posterUrl: webinar?.posterUrl ?? '',
      startsAt: toDateTimeLocal(webinar?.startsAt),
      endsAt: toDateTimeLocal(webinar?.endsAt),
      timezone: webinar?.timezone ?? 'Africa/Mogadishu',
      platform: webinar?.platform ?? 'zoom',
      venue: webinar?.venue ?? '',
      capacity: webinar?.capacity ? String(webinar.capacity) : '',
      registrationOpen: webinar?.registrationOpen ?? true,
      meetingUrl: webinar?.meetingUrl ?? '',
      meetingPasscode: webinar?.meetingPasscode ?? '',
      joinOpensMinutesBefore: String(webinar?.joinOpensMinutesBefore ?? 15),
      recordingUrl: webinar?.recordingUrl ?? '',
      featured: webinar?.featured ?? false,
      agenda: webinar?.agenda.join('\n') ?? '',
      speakers: webinar?.speakers.map((s) => ({ ...s, photoUrl: s.photoUrl ?? '' })) ?? [
        { name: '', title: '', organization: '', bio: '', photoUrl: '' },
      ],
    },
  });
  const speakers = useFieldArray({ control: form.control, name: 'speakers' });
  const e = form.formState.errors;
  const editable = webinar ? can('webinars.update') : can('webinars.create');
  const archived = webinar?.publicationStatus === 'archived';

  const submit = form.handleSubmit(async (v) => {
    setBanner(null);
    const body = {
      title: v.title,
      ...(v.slug ? { slug: v.slug } : {}),
      subtitle: v.subtitle,
      summary: v.summary,
      description: v.description,
      topic: v.topic,
      posterUrl: v.posterUrl || null,
      // datetime-local values are in this device's time zone; the server stores UTC instants.
      startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : undefined,
      endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : undefined,
      timezone: v.timezone,
      platform: v.platform,
      venue: v.venue,
      capacity: v.capacity ? Number(v.capacity) : null,
      registrationOpen: v.registrationOpen,
      meetingUrl: v.meetingUrl || null,
      meetingPasscode: v.meetingPasscode || null,
      joinOpensMinutesBefore: Number(v.joinOpensMinutesBefore) || 0,
      recordingUrl: v.recordingUrl || null,
      featured: v.featured,
      agenda: lines(v.agenda),
      speakers: v.speakers.filter((s) => s.name.trim()).map((s) => ({ ...s, photoUrl: s.photoUrl || null })),
    };
    try {
      const saved = webinar
        ? await apiPatch<AdminWebinarDto>(`/admin/webinars/${webinar.id}`, body)
        : await apiPost<AdminWebinarDto>('/admin/webinars', body);
      void qc.invalidateQueries({ queryKey: ['admin', 'webinars'] });
      void qc.invalidateQueries({ queryKey: ['webinars'] });
      void qc.invalidateQueries({ queryKey: ['webinar'] });
      qc.setQueryData(['admin', 'webinar', saved.id], saved);
      toast('Saved.');
      if (!webinar) navigate(`/admin/webinars/${saved.id}`, { replace: true });
    } catch (err) {
      setBanner(applyServerErrors(err, form.setError).message);
    }
  });

  return (
    <>
      <BackLink to="/admin/webinars">Webinars</BackLink>
      <div className="mt-4">
        <DashboardPageHeader
          title={webinar?.title ?? 'New webinar'}
          actions={
            webinar && (
              <div className="flex flex-wrap items-center gap-2">
                <WebinarStatusBadge status={webinar.status} />
                {webinar.publicationStatus === 'published' && (
                  <Button size="sm" variant="secondary" asChild>
                    <Link to={`/webinars/${webinar.slug}`}>
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
        {!editable && <AlertMessage tone="info">You can view this webinar but not edit it.</AlertMessage>}
        <fieldset disabled={!editable || archived} className="contents">
          <section className="grid gap-5 rounded-xl border border-border bg-background p-6 md:grid-cols-[1fr_16rem]">
            <div className="grid gap-5 md:grid-cols-2">
              <h2 className="text-lg md:col-span-2">Details</h2>
              <FormField label="Title" error={e.title?.message} className="md:col-span-2">
                <Input {...form.register('title')} />
              </FormField>
              <FormField label="Subtitle" error={e.subtitle?.message} className="md:col-span-2">
                <Input {...form.register('subtitle')} />
              </FormField>
              <FormField
                label="Topic"
                hint="Used for filtering, e.g. Artificial Intelligence"
                error={e.topic?.message}
              >
                <Input {...form.register('topic')} />
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
              <FormField
                label="Agenda (one item per line)"
                error={e.agenda?.message}
                className="md:col-span-2"
              >
                <Textarea rows={4} {...form.register('agenda')} />
              </FormField>
            </div>
            <Controller
              control={form.control}
              name="posterUrl"
              render={({ field }) => (
                <ImageUploader
                  label="Poster"
                  purpose="webinar_image"
                  aspect="4/5"
                  hint="Portrait poster, like the official Alifya webinar posters."
                  value={field.value || null}
                  onChange={(u) => field.onChange(u ?? '')}
                  error={e.posterUrl?.message}
                />
              )}
            />
          </section>

          <section className="grid gap-5 rounded-xl border border-border bg-background p-6 md:grid-cols-3">
            <h2 className="text-lg md:col-span-3">Schedule & registration</h2>
            <FormField label="Starts" hint="In this device's time zone" error={e.startsAt?.message}>
              <Input type="datetime-local" {...form.register('startsAt')} />
            </FormField>
            <FormField label="Ends" error={e.endsAt?.message}>
              <Input type="datetime-local" {...form.register('endsAt')} />
            </FormField>
            <FormField label="Shown in time zone" error={e.timezone?.message}>
              <Select {...form.register('timezone')}>
                {TIMEZONES.map((tz) => (
                  <option key={tz}>{tz}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Platform" error={e.platform?.message}>
              <Select {...form.register('platform')}>
                {WEBINAR_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {platformLabel(p)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Venue label" hint="Optional, e.g. ZOOM or a room name" error={e.venue?.message}>
              <Input {...form.register('venue')} />
            </FormField>
            <FormField label="Capacity" hint="Empty = unlimited" error={e.capacity?.message}>
              <Input type="number" min="1" {...form.register('capacity')} />
            </FormField>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox {...form.register('registrationOpen')} /> Registration open
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox {...form.register('featured')} /> Feature on the webinars page
            </label>
          </section>

          <section className="grid gap-5 rounded-xl border border-border bg-background p-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="flex items-center gap-2 text-lg">
                <FontAwesomeIcon icon={faLock} className="text-sm text-muted-foreground" aria-hidden />{' '}
                Private joining details
              </h2>
              <p className="text-sm text-muted-foreground">
                Never shown publicly. Registered participants see the link only from the time below until the
                end.
              </p>
            </div>
            <FormField
              label="Meeting link"
              hint="https:// link from Zoom, Meet, Teams…"
              error={e.meetingUrl?.message}
            >
              <Input type="url" autoComplete="off" {...form.register('meetingUrl')} />
            </FormField>
            <FormField label="Passcode" error={e.meetingPasscode?.message}>
              <Input autoComplete="off" {...form.register('meetingPasscode')} />
            </FormField>
            <FormField label="Joining opens (minutes before start)" error={e.joinOpensMinutesBefore?.message}>
              <Input type="number" min="0" max="240" {...form.register('joinOpensMinutesBefore')} />
            </FormField>
            <FormField
              label="Recording link"
              hint="Shown to registered participants after the webinar"
              error={e.recordingUrl?.message}
            >
              <Input type="url" autoComplete="off" {...form.register('recordingUrl')} />
            </FormField>
          </section>

          <section className="rounded-xl border border-border bg-background p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg">Speakers</h2>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  speakers.append({ name: '', title: '', organization: '', bio: '', photoUrl: '' })
                }
              >
                <FontAwesomeIcon icon={faPlus} aria-hidden /> Add speaker
              </Button>
            </div>
            {e.speakers?.message && (
              <p className="mb-3 text-xs font-medium text-danger">{e.speakers.message}</p>
            )}
            <div className="space-y-4">
              {speakers.fields.map((f, i) => (
                <div
                  key={f.id}
                  className="grid gap-5 rounded-lg border border-border bg-ivory p-5 md:grid-cols-[1fr_11rem]"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Name" error={e.speakers?.[i]?.name?.message}>
                      <Input {...form.register(`speakers.${i}.name`)} />
                    </FormField>
                    <FormField label="Role / title" error={e.speakers?.[i]?.title?.message}>
                      <Input {...form.register(`speakers.${i}.title`)} />
                    </FormField>
                    <FormField
                      label="Organisation"
                      className="sm:col-span-2"
                      error={e.speakers?.[i]?.organization?.message}
                    >
                      <Input {...form.register(`speakers.${i}.organization`)} />
                    </FormField>
                    <FormField
                      label="Biography"
                      className="sm:col-span-2"
                      error={e.speakers?.[i]?.bio?.message}
                    >
                      <Textarea rows={3} {...form.register(`speakers.${i}.bio`)} />
                    </FormField>
                    <div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        onClick={() => speakers.remove(i)}
                      >
                        <FontAwesomeIcon icon={faTrash} aria-hidden /> Remove speaker
                      </Button>
                    </div>
                  </div>
                  <Controller
                    control={form.control}
                    name={`speakers.${i}.photoUrl`}
                    render={({ field }) => (
                      <ImageUploader
                        label="Photo"
                        purpose="speaker_photo"
                        aspect="1/1"
                        value={field.value || null}
                        onChange={(u) => field.onChange(u ?? '')}
                      />
                    )}
                  />
                </div>
              ))}
            </div>
          </section>
        </fieldset>
        {editable && !archived && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/admin/webinars')}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Save webinar
            </Button>
          </div>
        )}
      </form>
    </>
  );
}

/* ================================ Registrations ================================ */
export function AdminWebinarRegistrationsPage() {
  const { id = '' } = useParams();
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  usePageMeta({ title: 'Webinar registrations', noindex: true });
  const webinar = useQuery({
    queryKey: ['admin', 'webinar', id],
    queryFn: () => apiGet<AdminWebinarDto>(`/admin/webinars/${id}`),
  });
  const regs = useQuery({
    queryKey: ['admin', 'webinar', id, 'registrations', page],
    queryFn: () => apiGetPaged<WebinarRegistrationDto[]>(`/admin/webinars/${id}/registrations`, { page }),
    placeholderData: keepPreviousData,
  });
  const attend = useMutation({
    mutationFn: ({ regId, attended }: { regId: string; attended: boolean }) =>
      apiPatch(`/admin/webinars/${id}/registrations/${regId}`, { attended }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'webinar', id, 'registrations'] }),
    onError: (err) => toast(normalizeError(err).message, 'danger'),
  });

  return (
    <>
      <BackLink to="/admin/webinars">Webinars</BackLink>
      <div className="mt-4">
        <DashboardPageHeader
          title="Registrations"
          description={
            webinar.data
              ? `${webinar.data.title} · ${webinar.data.registeredCount}${webinar.data.capacity ? ` of ${webinar.data.capacity}` : ''} registered`
              : undefined
          }
        />
      </div>
      {regs.isPending ? (
        <TableSkeleton />
      ) : regs.isError ? (
        <ErrorState onRetry={() => void regs.refetch()} />
      ) : regs.data.data.length === 0 ? (
        <EmptyState title="No registrations yet." />
      ) : (
        <>
          <DataTable
            caption="Registrations"
            rows={regs.data.data}
            rowKey={(r) => r.id}
            columns={[
              {
                key: 'name',
                header: 'Participant',
                cell: (r) => (
                  <span>
                    <span className="font-semibold">{r.user.fullName}</span>
                    <span className="block text-xs text-muted-foreground">{r.user.email}</span>
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                cell: (r) => (r.status === 'registered' ? 'Registered' : 'Cancelled'),
              },
              {
                key: 'date',
                header: 'Registered',
                hideBelow: 'md',
                cell: (r) => formatDateTime(r.registeredAt, i18n.language),
              },
              {
                key: 'attended',
                header: 'Attended',
                className: 'text-right',
                cell: (r) =>
                  r.status === 'registered' ? (
                    <label className="inline-flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={!!r.attendedAt}
                        disabled={attend.isPending}
                        onChange={(ev) => attend.mutate({ regId: r.id, attended: ev.target.checked })}
                        aria-label={`Mark ${r.user.fullName} as attended`}
                      />
                    </label>
                  ) : (
                    '—'
                  ),
              },
            ]}
          />
          <Pagination
            page={page}
            totalPages={regs.data.meta.totalPages}
            onChange={(p) => setParams({ page: String(p) })}
          />
        </>
      )}
    </>
  );
}
