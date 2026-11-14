import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faEnvelope, faGlobe, faLocationDot, faPhone } from '@fortawesome/free-solid-svg-icons';
import {
  faFacebookF,
  faInstagram,
  faLinkedinIn,
  faTiktok,
  faXTwitter,
  faYoutube,
} from '@fortawesome/free-brands-svg-icons';
import { contactMessageSchema, type ContactMessageInput } from '@alifya/shared';
import {
  BackLink,
  EmptyState,
  ErrorState,
  FormField,
  PageHeader,
  Pagination,
  SectionHeading,
} from '@/components/shared';
import { Button } from '@/components/ui/button';
import { AlertMessage, Skeleton } from '@/components/ui/feedback';
import { Input, Textarea } from '@/components/ui/form-controls';
import { applyServerErrors } from '@/features/auth/AuthCard';
import { InitialsAvatar, InstructorCard, ProgramCard } from '@/features/public/cards';
import { apiPost, normalizeError } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import {
  FALLBACK_SETTINGS,
  useInstructor,
  useInstructors,
  useProgram,
  usePrograms,
  useSiteSettings,
} from '@/lib/queries';
import { usePageMeta } from '@/lib/seo';

function DetailSkeleton() {
  return (
    <div className="container py-14" aria-busy="true">
      <Skeleton className="mb-4 h-10 w-2/3" />
      <Skeleton className="mb-8 h-5 w-1/2" />
      <Skeleton className="h-60 w-full" />
    </div>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((o) => (
        <li key={o} className="flex gap-3 rounded-md bg-mint p-3.5 text-sm">
          <FontAwesomeIcon icon={faCheck} className="mt-1 text-primary" aria-hidden />
          {o}
        </li>
      ))}
    </ul>
  );
}

/* ================================ About ================================ */
export function AboutPage() {
  const { t } = useTranslation();
  const { data: s = FALLBACK_SETTINGS, isPending } = useSiteSettings();
  const instructors = useInstructors({ limit: 4 });
  const a = s.about;
  const hasContent = !!(
    a.introduction ||
    a.summary ||
    a.mission ||
    a.vision ||
    a.approach ||
    a.values.length ||
    a.objectives.length
  );
  usePageMeta({ title: t('about.title'), description: a.summary ?? undefined });

  return (
    <>
      <PageHeader
        eyebrow={t('about.eyebrow')}
        title={t('about.title')}
        description={a.summary ?? undefined}
      />
      <div className="container py-12 sm:py-16">
        {isPending ? (
          <Skeleton className="h-60 w-full" />
        ) : !hasContent ? (
          // No invented institutional claims: show an honest state until the Academy supplies its content.
          <EmptyState title={t('about.pending')} />
        ) : (
          <div className="grid gap-12">
            {a.introduction && (
              <p className="max-w-prose whitespace-pre-line text-lg leading-relaxed text-foreground/90">
                {a.introduction}
              </p>
            )}
            {(a.mission || a.vision) && (
              <div className="grid gap-6 md:grid-cols-2">
                {a.mission && (
                  <section className="rounded-lg border border-border bg-ivory p-6 sm:p-8">
                    <p className="eyebrow mb-3">{t('about.mission')}</p>
                    <p className="whitespace-pre-line font-display text-2xl leading-snug text-primary">
                      {a.mission}
                    </p>
                  </section>
                )}
                {a.vision && (
                  <section className="rounded-lg border border-border bg-primary p-6 text-white sm:p-8">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                      {t('about.vision')}
                    </p>
                    <p className="whitespace-pre-line font-display text-2xl leading-snug">{a.vision}</p>
                  </section>
                )}
              </div>
            )}
            {a.values.length > 0 && (
              <section>
                <h2 className="mb-6">{t('about.values')}</h2>
                <CheckList items={a.values} />
              </section>
            )}
            {a.objectives.length > 0 && (
              <section>
                <h2 className="mb-6">{t('about.objectives')}</h2>
                <CheckList items={a.objectives} />
              </section>
            )}
            {a.approach && (
              <section>
                <h2 className="mb-4">{t('about.approach')}</h2>
                <p className="max-w-prose whitespace-pre-line leading-relaxed text-foreground/90">
                  {a.approach}
                </p>
              </section>
            )}
          </div>
        )}
        {instructors.data && instructors.data.data.length > 0 && (
          <section className="mt-16">
            <SectionHeading
              title={t('about.instructorsTitle')}
              action={
                <Link to="/instructors" className="text-sm font-semibold text-primary hover:underline">
                  {t('instructors.seeAll')}
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
      </div>
    </>
  );
}

/* ================================ Programs ================================ */
export function ProgramsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const programs = usePrograms({ page, limit: 12 });
  usePageMeta({ title: t('programs.title'), description: t('programs.subtitle') });
  return (
    <>
      <PageHeader
        eyebrow={t('programs.eyebrow')}
        title={t('programs.title')}
        description={t('programs.subtitle')}
      />
      <div className="container py-12 sm:py-14">
        {programs.isPending ? (
          <div className="grid gap-6">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        ) : programs.isError ? (
          <ErrorState onRetry={() => void programs.refetch()} />
        ) : programs.data.data.length === 0 ? (
          <EmptyState title={t('programs.empty')} />
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              {programs.data.data.map((p) => (
                <ProgramCard key={p.id} program={p} />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={programs.data.meta.totalPages}
              onChange={(p) => setParams({ page: String(p) })}
            />
          </>
        )}
      </div>
    </>
  );
}

export function ProgramDetailPage() {
  const { slug = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { data: p, isPending, isError, error, refetch } = useProgram(slug);
  usePageMeta({
    title: p?.title ?? t('programs.title'),
    description: p?.summary || undefined,
    image: p?.imageUrl,
  });
  if (isPending) return <DetailSkeleton />;
  if (isError) {
    return (
      <div className="container py-14">
        {normalizeError(error).status === 404 ? (
          <EmptyState
            title={t('programs.notFound')}
            action={<BackLink to="/programs">{t('programs.title')}</BackLink>}
          />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )}
      </div>
    );
  }
  return (
    <article>
      <header className="border-b border-border bg-ivory">
        <div className="container grid gap-8 py-10 sm:py-14 lg:grid-cols-[1fr_24rem] lg:items-center">
          <div>
            <BackLink to="/programs">{t('programs.title')}</BackLink>
            <h1 className="mt-6">{p.title}</h1>
            {p.summary && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{p.summary}</p>}
            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {p.durationText && (
                <div>
                  <dt className="text-muted-foreground">{t('programs.duration')}</dt>
                  <dd className="font-semibold">{p.durationText}</dd>
                </div>
              )}
              {p.coordinator && (
                <div>
                  <dt className="text-muted-foreground">{t('programs.coordinator')}</dt>
                  <dd className="font-semibold">{p.coordinator.fullName}</dd>
                </div>
              )}
            </dl>
          </div>
          {p.imageUrl && (
            <img src={p.imageUrl} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
          )}
        </div>
      </header>
      <div className="container grid gap-12 py-12">
        {p.description && (
          <p className="max-w-prose whitespace-pre-line leading-relaxed text-foreground/90">
            {p.description}
          </p>
        )}
        {p.objectives.length > 0 && (
          <section>
            <h2 className="mb-5 text-2xl">{t('programs.objectives')}</h2>
            <CheckList items={p.objectives} />
          </section>
        )}
        {p.entryRequirements.length > 0 && (
          <section>
            <h2 className="mb-4 text-2xl">{t('programs.requirements')}</h2>
            <ul className="list-disc space-y-2 pl-5 text-foreground/90">
              {p.entryRequirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h2 className="mb-5 text-2xl">{t('programs.courses')}</h2>
          {p.courses.length === 0 ? (
            <p className="text-muted-foreground">{t('programs.noCourses')}</p>
          ) : (
            <ol className="divide-y divide-border rounded-lg border border-border">
              {p.courses.map((c, i) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint text-sm font-bold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <Link to={`/courses/${c.slug}`} className="font-semibold text-primary hover:underline">
                        {c.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {[t(`levels.${c.level}`), c.durationText].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <span className="pl-12 text-sm font-semibold sm:pl-0">
                    {c.isFree ? t('common.free') : formatMoney(c.feeAmount, c.currency, i18n.language)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </article>
  );
}

/* ================================ Instructors ================================ */
export function InstructorsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const list = useInstructors({ page, limit: 12 });
  usePageMeta({ title: t('instructors.title'), description: t('instructors.subtitle') });
  return (
    <>
      <PageHeader
        eyebrow={t('instructors.eyebrow')}
        title={t('instructors.title')}
        description={t('instructors.subtitle')}
      />
      <div className="container py-12 sm:py-14">
        {list.isPending ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[4/5] w-full" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : list.data.data.length === 0 ? (
          <EmptyState title={t('instructors.empty')} />
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {list.data.data.map((i) => (
                <InstructorCard key={i.id} instructor={i} />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={list.data.meta.totalPages}
              onChange={(p) => setParams({ page: String(p) })}
            />
          </>
        )}
      </div>
    </>
  );
}

const SOCIAL = { linkedin: faLinkedinIn, x: faXTwitter, facebook: faFacebookF, website: faGlobe } as const;

export function InstructorDetailPage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { data: p, isPending, isError, error, refetch } = useInstructor(id);
  usePageMeta({
    title: p?.fullName ?? t('instructors.title'),
    description: p?.biography.slice(0, 160),
    image: p?.photoUrl,
  });
  if (isPending) return <DetailSkeleton />;
  if (isError) {
    return (
      <div className="container py-14">
        {normalizeError(error).status === 404 ? (
          <EmptyState
            title={t('instructors.notFound')}
            action={<BackLink to="/instructors">{t('instructors.title')}</BackLink>}
          />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )}
      </div>
    );
  }
  const socials = Object.entries(p.social).filter(([, v]) => !!v) as [keyof typeof SOCIAL, string][];
  return (
    <article className="container py-10 sm:py-14">
      <BackLink to="/instructors">{t('instructors.title')}</BackLink>
      <div className="mt-8 grid gap-10 md:grid-cols-[18rem_1fr]">
        <div className="aspect-[4/5] w-full max-w-xs overflow-hidden rounded-lg bg-mint">
          {p.photoUrl ? (
            <img src={p.photoUrl} alt={p.fullName} className="h-full w-full object-cover" />
          ) : (
            <InitialsAvatar name={p.fullName} className="h-full w-full text-5xl" />
          )}
        </div>
        <div>
          <h1>{p.fullName}</h1>
          {p.professionalTitle && (
            <p className="mt-2 text-lg font-semibold text-accent-strong">{p.professionalTitle}</p>
          )}
          {p.specialization && <p className="mt-1 text-muted-foreground">{p.specialization}</p>}
          {socials.length > 0 && (
            <ul className="mt-5 flex gap-2">
              {socials.map(([k, url]) => (
                <li key={k}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={k}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border text-primary hover:border-primary"
                  >
                    <FontAwesomeIcon icon={SOCIAL[k]} />
                  </a>
                </li>
              ))}
            </ul>
          )}
          {p.biography && (
            <p className="mt-6 max-w-prose whitespace-pre-line leading-relaxed text-foreground/90">
              {p.biography}
            </p>
          )}
          <section className="mt-10">
            <h2 className="mb-4 text-2xl">{t('instructors.courses')}</h2>
            {p.courses.length === 0 ? (
              <p className="text-muted-foreground">{t('instructors.noCourses')}</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {p.courses.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 p-4">
                    <Link to={`/courses/${c.slug}`} className="font-semibold text-primary hover:underline">
                      {c.title}
                    </Link>
                    <span className="text-sm">
                      {c.isFree ? t('common.free') : formatMoney(c.feeAmount, c.currency, i18n.language)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}

/* ================================ Contact ================================ */
const SITE_SOCIAL = {
  facebook: faFacebookF,
  instagram: faInstagram,
  linkedin: faLinkedinIn,
  x: faXTwitter,
  youtube: faYoutube,
  tiktok: faTiktok,
} as const;

export function ContactPage() {
  const { t } = useTranslation();
  const { data: s = FALLBACK_SETTINGS } = useSiteSettings();
  const [sent, setSent] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const form = useForm<ContactMessageInput>({
    resolver: zodResolver(contactMessageSchema),
    defaultValues: { name: '', email: '', phone: '', subject: '', message: '', website: '' },
  });
  usePageMeta({ title: t('contact.title'), description: t('contact.subtitle') });
  const onSubmit = form.handleSubmit(async (v) => {
    setBanner(null);
    try {
      await apiPost('/contact', v);
      setSent(true);
      form.reset();
    } catch (err) {
      setBanner(applyServerErrors(err, form.setError).message);
    }
  });
  const socials = Object.entries(s.social).filter(([, v]) => !!v) as [keyof typeof SITE_SOCIAL, string][];
  const e = form.formState.errors;

  return (
    <>
      <PageHeader title={t('contact.title')} description={t('contact.subtitle')} />
      <div className="container grid gap-10 py-12 lg:grid-cols-[1fr_22rem]">
        <form
          onSubmit={onSubmit}
          noValidate
          className="flex flex-col gap-5 rounded-lg border border-border bg-background p-6 sm:p-8"
        >
          {sent && <AlertMessage tone="success">{t('contact.sent')}</AlertMessage>}
          {banner && <AlertMessage tone="danger">{banner}</AlertMessage>}
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label={t('contact.name')} error={e.name?.message}>
              <Input autoComplete="name" {...form.register('name')} />
            </FormField>
            <FormField label={t('contact.email')} error={e.email?.message}>
              <Input type="email" autoComplete="email" {...form.register('email')} />
            </FormField>
            <FormField label={t('contact.phone')} error={e.phone?.message}>
              <Input type="tel" autoComplete="tel" {...form.register('phone')} />
            </FormField>
            <FormField label={t('contact.subject')} error={e.subject?.message}>
              <Input {...form.register('subject')} />
            </FormField>
          </div>
          <FormField label={t('contact.message')} error={e.message?.message}>
            <Textarea rows={6} {...form.register('message')} />
          </FormField>
          {/* Honeypot — hidden from people and assistive tech. */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="hidden"
            {...form.register('website')}
          />
          <Button type="submit" size="lg" className="self-start" loading={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t('contact.sending') : t('contact.send')}
          </Button>
        </form>
        <aside className="flex flex-col gap-6">
          <section className="rounded-lg border border-border bg-ivory p-6">
            <h2 className="mb-4 text-xl">{t('contact.details')}</h2>
            {s.contact.email || s.contact.phones.length || s.contact.address ? (
              <ul className="space-y-3 text-sm">
                {s.contact.email && (
                  <li className="flex gap-3">
                    <FontAwesomeIcon icon={faEnvelope} className="mt-0.5 text-accent-strong" aria-hidden />
                    <a href={`mailto:${s.contact.email}`} className="break-all hover:underline">
                      {s.contact.email}
                    </a>
                  </li>
                )}
                {s.contact.phones.map((p) => (
                  <li key={p} className="flex gap-3">
                    <FontAwesomeIcon icon={faPhone} className="mt-0.5 text-accent-strong" aria-hidden />
                    <a href={`tel:${p.replace(/\s/g, '')}`} className="hover:underline">
                      {p}
                    </a>
                  </li>
                ))}
                {s.contact.address && (
                  <li className="flex gap-3">
                    <FontAwesomeIcon icon={faLocationDot} className="mt-0.5 text-accent-strong" aria-hidden />
                    <span>{s.contact.address}</span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('footer.contactPending')}</p>
            )}
          </section>
          {socials.length > 0 && (
            <section className="rounded-lg border border-border p-6">
              <h2 className="mb-4 text-xl">{t('contact.follow')}</h2>
              <ul className="flex flex-wrap gap-2">
                {socials.map(([k, url]) => (
                  <li key={k}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={k}
                      className="grid h-10 w-10 place-items-center rounded-full border border-border text-primary hover:border-primary"
                    >
                      <FontAwesomeIcon icon={SITE_SOCIAL[k]} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
