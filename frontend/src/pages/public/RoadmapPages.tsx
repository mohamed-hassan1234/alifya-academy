import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faClock,
  faLayerGroup,
  faRoute,
} from '@fortawesome/free-solid-svg-icons';
import type { LearningPathStageDto, PublicLearningPathDto } from '@alifya/shared';
import { BackLink, EmptyState, ErrorState, PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/feedback';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  LearningRoad,
  MiniRoad,
  StateBadge,
  type RoadStage,
  type StageState,
} from '@/features/roadmap/LearningRoad';
import { normalizeError } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useLearningPath, useLearningPaths } from '@/lib/queries';
import { usePageMeta } from '@/lib/seo';

/* ================================ Listing ================================ */
export function RoadmapsPage() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useLearningPaths({ limit: 24 });
  usePageMeta({ title: t('roadmaps.title'), description: t('roadmaps.subtitle') });

  return (
    <>
      <PageHeader
        eyebrow={t('roadmaps.eyebrow')}
        title={t('roadmaps.title')}
        description={t('roadmaps.subtitle')}
      />
      <div className="container py-12 sm:py-16">
        {isPending ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : data.data.length === 0 ? (
          <EmptyState icon={faRoute} title={t('roadmaps.empty')} />
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.data.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/roadmaps/${p.slug}`}
                  className="group flex h-full flex-col rounded-xl border border-border bg-background p-6 transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-card"
                >
                  <div className="rounded-lg bg-ivory px-3 py-4">
                    <MiniRoad stops={p.stageCount} className="h-16 w-full" />
                  </div>
                  <h2 className="mt-6 text-xl group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                    {p.title}
                  </h2>
                  {p.summary && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.summary}</p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-6 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <FontAwesomeIcon icon={faRoute} aria-hidden />{' '}
                      {t('roadmaps.stages', { count: p.stageCount })}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <FontAwesomeIcon icon={faLayerGroup} aria-hidden />{' '}
                      {t('roadmaps.courses', { count: p.courseCount })}
                    </span>
                    {p.durationText && (
                      <span className="inline-flex items-center gap-2">
                        <FontAwesomeIcon icon={faClock} aria-hidden /> {p.durationText}
                      </span>
                    )}
                  </div>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    {t('roadmaps.explore')}
                    <FontAwesomeIcon
                      icon={faArrowRight}
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ================================ Detail ================================ */

/**
 * Stage states. Personal progress needs enrolment records, which the platform does not track yet, so
 * every stage of a published roadmap is "available" — no progress is ever invented.
 */
function stageStates(p: PublicLearningPathDto): StageState[] {
  return p.stages.map(() => 'available');
}

export function RoadmapDetailPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: p, isPending, isError, error, refetch } = useLearningPath(slug);
  const [selected, setSelectedState] = useState<string | null>(null);
  const lastStage = useRef<string | null>(null);
  const setSelected = (id: string | null) => {
    if (id) lastStage.current = id;
    setSelectedState(id);
  };
  usePageMeta({ title: p?.title ?? t('roadmaps.title'), description: p?.summary || undefined });

  if (isPending)
    return (
      <div className="container py-14">
        <Skeleton className="mb-4 h-10 w-2/3" />
        <Skeleton className="h-[32rem] w-full" />
      </div>
    );
  if (isError)
    return normalizeError(error).status === 404 ? (
      <div className="container py-16">
        <EmptyState
          icon={faRoute}
          title={t('roadmaps.notFound')}
          action={<BackLink to="/roadmaps">{t('roadmaps.title')}</BackLink>}
        />
      </div>
    ) : (
      <div className="container py-16">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );

  const states = stageStates(p);
  const roadStages: RoadStage[] = p.stages.map((s, i) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    durationText: s.durationText,
    courseCount: s.courses.length,
    state: states[i]!,
  }));
  const index = p.stages.findIndex((s) => s.id === selected);
  const stage = index >= 0 ? p.stages[index] : undefined;

  return (
    <>
      <section className="border-b border-border bg-ivory">
        <div className="container py-10 sm:py-14">
          <BackLink to="/roadmaps">{t('roadmaps.title')}</BackLink>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <p className="eyebrow">{t('roadmaps.eyebrow')}</p>
              <h1 className="mt-3">{p.title}</h1>
              {p.summary && (
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{p.summary}</p>
              )}
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <Meta label={t('roadmaps.stagesLabel')} value={String(p.stageCount)} />
                <Meta label={t('roadmaps.coursesLabel')} value={String(p.courseCount)} />
                {p.durationText && <Meta label={t('roadmaps.duration')} value={p.durationText} />}
              </dl>
            </div>
            {p.outcomes.length > 0 && (
              <div className="rounded-xl border border-border bg-background p-6">
                <h2 className="text-base">{t('roadmaps.outcomes')}</h2>
                <ul className="mt-4 space-y-2.5">
                  {p.outcomes.map((o) => (
                    <li key={o} className="flex gap-3 text-sm">
                      <FontAwesomeIcon icon={faCheck} className="mt-1 text-primary" aria-hidden />
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="container py-12 sm:py-16">
        {p.description && (
          <p className="mx-auto mb-10 max-w-prose whitespace-pre-line text-center leading-relaxed text-muted-foreground">
            {p.description}
          </p>
        )}
        <p className="mb-8 text-center text-sm text-muted-foreground">
          {user ? t('roadmaps.progressNote') : t('roadmaps.hint')}
        </p>
        {p.stages.length === 0 ? (
          <EmptyState icon={faRoute} title={t('roadmaps.noStages')} />
        ) : (
          <div className="mx-auto max-w-5xl">
            <LearningRoad stages={roadStages} selectedId={selected} onSelect={setSelected} />
          </div>
        )}
      </section>

      <Drawer
        open={!!stage}
        onOpenChange={(o) => !o && setSelected(null)}
        // Opened from state rather than a trigger, so return focus to the stage card explicitly.
        returnFocusTo={() => document.querySelector<HTMLElement>(`[data-stage-id="${lastStage.current}"]`)}
        title={stage ? t('roadmaps.stageOf', { n: index + 1, total: p.stages.length }) : ''}
        wide
      >
        {stage && (
          <StagePanel
            stage={stage}
            index={index}
            total={p.stages.length}
            state={states[index]!}
            previous={index > 0 ? p.stages[index - 1] : undefined}
            onNavigate={(to) => setSelected(p.stages[to]?.id ?? null)}
          />
        )}
      </Drawer>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-xl text-foreground">{value}</dd>
    </div>
  );
}

function StagePanel({
  stage,
  index,
  total,
  state,
  previous,
  onNavigate,
}: {
  stage: LearningPathStageDto;
  index: number;
  total: number;
  state: StageState;
  previous?: LearningPathStageDto;
  onNavigate: (index: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const first = stage.courses[0];
  return (
    <div className="flex min-h-full flex-col gap-7 px-1 pb-2">
      <div>
        <StateBadge state={state} />
        <h2 className="mt-3 text-2xl">{stage.title}</h2>
        {stage.durationText && (
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <FontAwesomeIcon icon={faClock} aria-hidden /> {stage.durationText}
          </p>
        )}
        {stage.description && (
          <p className="mt-4 whitespace-pre-line leading-relaxed text-foreground/90">{stage.description}</p>
        )}
      </div>

      {stage.objectives.length > 0 && (
        <section>
          <h3 className="text-base">{t('roadmaps.objectives')}</h3>
          <ul className="mt-3 space-y-2.5">
            {stage.objectives.map((o) => (
              <li key={o} className="flex gap-3 text-sm">
                <FontAwesomeIcon icon={faCheck} className="mt-1 text-primary" aria-hidden />
                {o}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-base">{t('roadmaps.prerequisite')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {previous
            ? t('roadmaps.prerequisiteText', { n: index, title: previous.title })
            : t('roadmaps.noPrerequisite')}
        </p>
      </section>

      <section>
        <h3 className="text-base">{t('roadmaps.coursesInStage')}</h3>
        {stage.courses.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('roadmaps.noCourses')}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {stage.courses.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/courses/${c.slug}`}
                  className="flex items-center gap-4 rounded-lg border border-border p-3 transition-colors hover:border-border-strong hover:bg-surface-hover"
                >
                  {c.thumbnailUrl ? (
                    <img
                      src={c.thumbnailUrl}
                      alt=""
                      className="h-14 w-20 shrink-0 rounded-md border border-border bg-white object-contain"
                    />
                  ) : (
                    <span className="grid h-14 w-20 shrink-0 place-items-center rounded-md bg-mint text-primary">
                      <FontAwesomeIcon icon={faLayerGroup} aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug text-foreground">{c.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {[t(`levels.${c.level}`), c.durationText].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">
                    {c.isFree ? t('common.free') : formatMoney(c.feeAmount, c.currency, i18n.language)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-auto space-y-3 border-t border-border pt-5">
        {first && (
          <Button asChild className="w-full">
            <Link to={`/courses/${first.slug}`}>{t('roadmaps.startWith', { title: first.title })}</Link>
          </Button>
        )}
        <div className="flex justify-between gap-3">
          <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => onNavigate(index - 1)}>
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden /> {t('roadmaps.previous')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={index === total - 1}
            onClick={() => onNavigate(index + 1)}
          >
            {t('roadmaps.next')} <FontAwesomeIcon icon={faArrowRight} aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
