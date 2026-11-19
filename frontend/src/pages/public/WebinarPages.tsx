import { useState, type FormEvent } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCheck,
  faCircleCheck,
  faMagnifyingGlass,
  faMicrophoneLines,
  faUpRightFromSquare,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import type { PublicWebinarDto } from '@alifya/shared';
import { EmptyState, ErrorState, PageHeader, Pagination, useConfirm } from '@/components/shared';
import { useToast } from '@/components/shared/toast';
import { Button } from '@/components/ui/button';
import { AlertMessage, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/form-controls';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  FeaturedWebinar,
  POSTER_SURFACE,
  WebinarCard,
  WebinarPill,
  WebinarPoster,
  WebinarStatusBadge,
  WebinarWhen,
} from '@/features/webinars/WebinarVisuals';
import { apiDelete, apiPost, normalizeError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useMyWebinarRegistration, useWebinar, useWebinarTopics, useWebinars } from '@/lib/queries';
import { usePageMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';

/* ================================ Listing ================================ */
export function WebinarsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const when = params.get('when') === 'past' ? 'past' : 'upcoming';
  const q = params.get('q') ?? '';
  const topic = params.get('topic') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [draft, setDraft] = useState(q);
  usePageMeta({ title: t('webinars.title'), description: t('webinars.subtitle') });

  const list = useWebinars({ when, q, topic, page, limit: 12 });
  const topics = useWebinarTopics();
  // Featured: the next upcoming webinar (marked featured first); otherwise the most recent one.
  const nextUp = useWebinars({ when: 'upcoming', limit: 1 });
  const lastPast = useWebinars({ when: 'past', limit: 1 });
  const featured = nextUp.data?.data[0] ?? lastPast.data?.data[0];
  const filtered = !!(q || topic);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    set({ q: draft.trim() });
  };

  return (
    <>
      <PageHeader
        eyebrow={t('webinars.eyebrow')}
        title={t('webinars.title')}
        description={t('webinars.subtitle')}
      />
      <div className="container space-y-12 py-12 sm:py-16">
        {featured && !filtered && page === 1 && <FeaturedWebinar w={featured} />}

        <section aria-labelledby="webinar-list">
          <h2 id="webinar-list" className="sr-only">
            {t('webinars.title')}
          </h2>
          <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="tablist"
              aria-label={t('webinars.title')}
              className="inline-flex rounded-lg border border-border bg-ivory p-1"
            >
              {(['upcoming', 'past'] as const).map((k) => (
                <button
                  key={k}
                  role="tab"
                  type="button"
                  aria-selected={when === k}
                  onClick={() => set({ when: k === 'past' ? 'past' : '' })}
                  className={cn(
                    'rounded-md px-4 py-2 text-sm font-semibold transition-colors',
                    when === k
                      ? 'bg-background text-primary shadow-card'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(`webinars.tabs.${k}`)}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <form onSubmit={onSearch} role="search" className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('webinars.search')}
                  aria-label={t('webinars.search')}
                  className="sm:w-64"
                />
                <Button type="submit" variant="secondary" size="icon" aria-label={t('webinars.search')}>
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </Button>
              </form>
              {(topics.data?.length ?? 0) > 0 && (
                <Select
                  aria-label={t('webinars.topic')}
                  value={topic}
                  onChange={(e) => set({ topic: e.target.value })}
                  className="sm:w-52"
                >
                  <option value="">{t('webinars.allTopics')}</option>
                  {topics.data!.map((tp) => (
                    <option key={tp} value={tp}>
                      {tp}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>

          <div className="mt-8">
            {list.isPending ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-60" />
                ))}
              </div>
            ) : list.isError ? (
              <ErrorState onRetry={() => void list.refetch()} />
            ) : list.data.data.length === 0 ? (
              <EmptyState
                icon={faMicrophoneLines}
                title={filtered ? t('webinars.noMatches') : t(`webinars.empty.${when}`)}
                action={
                  filtered ? (
                    <Button variant="secondary" onClick={() => (setDraft(''), set({ q: '', topic: '' }))}>
                      {t('webinars.clearFilters')}
                    </Button>
                  ) : when === 'upcoming' ? (
                    <Button variant="secondary" onClick={() => set({ when: 'past' })}>
                      {t('webinars.seePast')}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <ul className="grid gap-6 lg:grid-cols-2">
                  {list.data.data.map((w) => (
                    <li key={w.id}>
                      <WebinarCard w={w} />
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={page}
                  totalPages={list.data.meta.totalPages}
                  onChange={(p) => set({ page: String(p) })}
                />
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

/* ================================ Detail ================================ */
export function WebinarDetailPage() {
  const { slug = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { data: w, isPending, isError, error, refetch } = useWebinar(slug);
  usePageMeta({
    title: w?.title ?? t('webinars.title'),
    description: w?.summary || w?.subtitle || undefined,
  });

  if (isPending)
    return (
      <div className="container py-14">
        <Skeleton className="mb-6 h-72 w-full" />
        <Skeleton className="h-40 w-2/3" />
      </div>
    );
  if (isError)
    return (
      <div className="container py-16">
        {normalizeError(error).status === 404 ? (
          <EmptyState
            icon={faMicrophoneLines}
            title={t('webinars.notFound')}
            action={
              <Button variant="secondary" asChild>
                <Link to="/webinars">{t('webinars.title')}</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )}
      </div>
    );

  return (
    <>
      {/* Poster-style hero */}
      <section className={POSTER_SURFACE}>
        <div className="container py-10 sm:py-14">
          <Link
            to="/webinars"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"
          >
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden /> {t('webinars.title')}
          </Link>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-16">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <WebinarPill />
                <WebinarStatusBadge status={w.status} onDark />
                {w.topic && (
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                    {w.topic}
                  </span>
                )}
              </div>
              <h1 className="mt-5 text-[clamp(2rem,1.3rem+2.6vw,3.4rem)] leading-[1.05] text-white">
                {w.title}
              </h1>
              {w.subtitle && <p className="mt-4 max-w-2xl text-lg text-white/80">{w.subtitle}</p>}
              <WebinarWhen w={w} className="mt-8 text-base text-white/90" iconClassName="text-accent" />
            </div>
            <div className="mx-auto w-full max-w-[20rem]">
              <WebinarPoster w={w} className="border border-white/15 shadow-lift" />
            </div>
          </div>
        </div>
      </section>

      <div className="container grid gap-12 py-12 sm:py-16 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="min-w-0 space-y-12">
          {w.cancelReason !== null && (
            <AlertMessage tone="warning">
              {t('webinars.cancelledNotice')}
              {w.cancelReason ? ` ${w.cancelReason}` : ''}
            </AlertMessage>
          )}
          {(w.description || w.summary) && (
            <section>
              <h2 className="text-2xl">{t('webinars.about')}</h2>
              <p className="mt-4 max-w-prose whitespace-pre-line leading-relaxed text-foreground/90">
                {w.description || w.summary}
              </p>
            </section>
          )}
          {w.agenda.length > 0 && (
            <section>
              <h2 className="text-2xl">{t('webinars.agenda')}</h2>
              <ol className="mt-5 divide-y divide-border rounded-xl border border-border">
                {w.agenda.map((a, i) => (
                  <li key={i} className="flex gap-4 p-4 text-sm">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="pt-1">{a}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {w.speakers.length > 0 && (
            <section>
              <h2 className="text-2xl">
                {w.speakers.length > 1 ? t('webinars.speakers') : t('webinars.speaker')}
              </h2>
              <ul className="mt-5 space-y-5">
                {w.speakers.map((s) => (
                  <li
                    key={s.name}
                    className="grid gap-5 rounded-xl border border-border p-5 sm:grid-cols-[8rem_1fr]"
                  >
                    {s.photoUrl ? (
                      <img
                        src={s.photoUrl}
                        alt={s.name}
                        className="aspect-square w-32 rounded-lg bg-mint object-cover object-top"
                      />
                    ) : (
                      <span
                        className={cn(
                          'grid aspect-square w-32 place-items-center rounded-lg font-display text-3xl',
                          POSTER_SURFACE,
                        )}
                      >
                        {s.name.slice(0, 1)}
                      </span>
                    )}
                    <div>
                      <span className="inline-flex rounded-sm bg-accent/25 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-accent-strong">
                        {t('webinars.guest')}
                      </span>
                      <h3 className="mt-2 text-xl">{s.name}</h3>
                      {(s.title || s.organization) && (
                        <p className="text-sm text-muted-foreground">
                          {[s.title, s.organization].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {s.bio && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{s.bio}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24">
          <RegistrationPanel w={w} />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t('webinars.timesIn', { zone: w.timezone })} ·{' '}
            {formatDateTime(w.startsAt, i18n.language, w.timezone)}
          </p>
        </aside>
      </div>

      {w.related.length > 0 && (
        <section className="border-t border-border bg-ivory">
          <div className="container py-12 sm:py-16">
            <h2 className="text-2xl">{t('webinars.related')}</h2>
            <ul className="mt-6 grid gap-6 lg:grid-cols-2">
              {w.related.map((r) => (
                <li key={r.id}>
                  <WebinarCard w={r} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

function RegistrationPanel({ w }: { w: PublicWebinarDto }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const mine = useMyWebinarRegistration(w.slug, !!user);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['webinar', w.slug] });
    void qc.invalidateQueries({ queryKey: ['webinars'] });
  };
  const register = useMutation({
    mutationFn: () => apiPost(`/webinars/${w.slug}/registration`),
    onSuccess: () => {
      toast(t('webinars.registeredToast'));
      refresh();
    },
    onError: (err) => toast(normalizeError(err).message, 'danger'),
  });
  const cancel = useMutation({
    mutationFn: () => apiDelete(`/webinars/${w.slug}/registration`),
    onSuccess: () => {
      toast(t('webinars.cancelledToast'));
      refresh();
    },
    onError: (err) => toast(normalizeError(err).message, 'danger'),
  });

  const reg = mine.data;
  const ended = w.status === 'completed' || w.status === 'cancelled';
  let body: React.ReactNode;

  if (w.status === 'cancelled')
    body = <p className="text-sm text-muted-foreground">{t('webinars.panel.cancelled')}</p>;
  else if (user && mine.isPending) body = <Skeleton className="h-11 w-full" />;
  else if (reg?.registered) {
    body = (
      <div className="space-y-4">
        <p className="flex items-center gap-2 font-semibold text-success">
          <FontAwesomeIcon icon={faCircleCheck} aria-hidden /> {t('webinars.panel.registered')}
        </p>
        {reg.canJoinNow && reg.meetingUrl ? (
          <>
            <Button asChild className="w-full">
              <a href={reg.meetingUrl} target="_blank" rel="noopener noreferrer">
                {t('webinars.panel.join')} <FontAwesomeIcon icon={faUpRightFromSquare} aria-hidden />
              </a>
            </Button>
            {reg.meetingPasscode && (
              <p className="text-sm">
                {t('webinars.panel.passcode')}:{' '}
                <span className="font-mono font-semibold">{reg.meetingPasscode}</span>
              </p>
            )}
          </>
        ) : reg.recordingUrl ? (
          <Button asChild className="w-full">
            <a href={reg.recordingUrl} target="_blank" rel="noopener noreferrer">
              {t('webinars.panel.recording')} <FontAwesomeIcon icon={faUpRightFromSquare} aria-hidden />
            </a>
          </Button>
        ) : !ended ? (
          <p className="text-sm text-muted-foreground">
            {t('webinars.panel.joinOpens', {
              time: formatDateTime(reg.joinOpensAt, i18n.language, w.timezone),
            })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t('webinars.panel.ended')}</p>
        )}
        {!ended && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-danger"
            loading={cancel.isPending}
            onClick={async () => {
              if (await confirm(t('webinars.panel.cancelTitle'), t('webinars.panel.cancelBody'), true))
                cancel.mutate();
            }}
          >
            {t('webinars.panel.cancel')}
          </Button>
        )}
      </div>
    );
  } else if (w.status === 'completed')
    body = <p className="text-sm text-muted-foreground">{t('webinars.panel.ended')}</p>;
  else if (w.status === 'registration_open' || w.status === 'live') {
    body = user ? (
      <Button className="w-full" loading={register.isPending} onClick={() => register.mutate()}>
        {t('webinars.panel.register')}
      </Button>
    ) : (
      <div className="space-y-3">
        <Button asChild className="w-full">
          <Link to="/login" state={{ from: location.pathname }}>
            {t('webinars.panel.signInToRegister')}
          </Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t('webinars.panel.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            {t('nav.register')}
          </Link>
        </p>
      </div>
    );
  } else body = <p className="text-sm text-muted-foreground">{t('webinars.panel.closed')}</p>;

  return (
    <div className="rounded-xl border border-border bg-background p-6 shadow-card">
      {dialog}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{t('webinars.panel.title')}</span>
        <WebinarStatusBadge status={w.status} />
      </div>
      <p className="mt-1 font-display text-2xl text-foreground">{t('webinars.free')}</p>
      <WebinarWhen w={w} className="mt-4 text-muted-foreground" />
      {w.seatsLeft !== null && !ended && (
        <p className="mt-3 flex items-center gap-2.5 text-sm text-muted-foreground">
          <FontAwesomeIcon icon={faUsers} className="w-4 text-accent-strong" aria-hidden />
          {t('webinars.seatsLeft', { count: w.seatsLeft })}
        </p>
      )}
      <div className="mt-6 border-t border-border pt-5">{body}</div>
      {!ended && (
        <ul className="mt-5 space-y-1.5 text-xs text-muted-foreground">
          <li className="flex gap-2">
            <FontAwesomeIcon icon={faCheck} className="mt-0.5 text-primary" aria-hidden />{' '}
            {t('webinars.panel.note1')}
          </li>
          <li className="flex gap-2">
            <FontAwesomeIcon icon={faCheck} className="mt-0.5 text-primary" aria-hidden />{' '}
            {t('webinars.panel.note2')}
          </li>
        </ul>
      )}
    </div>
  );
}
