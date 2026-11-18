import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookOpen, faEye, faFilePdf, faLock, faPlay } from '@fortawesome/free-solid-svg-icons';
import type { LessonPreviewDto } from '@alifya/shared';
import { ErrorState } from '@/components/shared';
import { Modal } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/feedback';
import { apiGet } from '@/lib/api';
import { useCurriculumOutline } from '@/lib/queries';

const TYPE_ICON = { text: faBookOpen, video: faPlay, pdf: faFilePdf } as const;

/** Public curriculum: titles only. Lesson bodies are visible solely for lessons marked as previews. */
export function CurriculumOutline({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const outline = useCurriculumOutline(slug);
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (outline.isPending) return <Skeleton className="h-40 w-full" />;
  if (outline.isError) return null; // course page still works without the outline
  const o = outline.data;

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl">{t('curriculum.title')}</h2>
        {o.totalLessons > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('curriculum.lessons', { count: o.totalLessons })}
            {o.totalMinutes > 0 && ` · ${t('curriculum.minutes', { count: o.totalMinutes })}`}
          </p>
        )}
      </div>
      {o.sections.length === 0 ? (
        <p className="rounded-md bg-mint p-4 text-sm text-foreground/80">{t('curriculum.empty')}</p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {o.sections.map((s, si) => (
            <details key={s.id} open={si === 0} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-ivory px-4 py-3.5 font-semibold text-primary marker:hidden">
                <span>{s.title}</span>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {t('curriculum.lessons', { count: s.lessons.length })}
                </span>
              </summary>
              <ul className="divide-y divide-border">
                {s.lessons.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="flex min-w-0 items-center gap-3">
                      <FontAwesomeIcon
                        icon={TYPE_ICON[l.type]}
                        className="w-4 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="sr-only">
                        {t(`curriculum.type${l.type[0]!.toUpperCase()}${l.type.slice(1)}`)}:
                      </span>
                      <span className="truncate">{l.title}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      {l.durationMinutes ? t('curriculum.minutes', { count: l.durationMinutes }) : null}
                      {l.isPreview ? (
                        <button
                          type="button"
                          onClick={() => setPreviewId(l.id)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-1 font-semibold text-accent-strong hover:bg-accent/30"
                        >
                          <FontAwesomeIcon icon={faEye} aria-hidden /> {t('curriculum.preview')}
                        </button>
                      ) : (
                        <FontAwesomeIcon icon={faLock} aria-label="Enrolled students only" />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
      {previewId && <PreviewModal slug={slug} lessonId={previewId} onClose={() => setPreviewId(null)} />}
    </section>
  );
}

function PreviewModal({ slug, lessonId, onClose }: { slug: string; lessonId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ['lesson-preview', slug, lessonId],
    queryFn: () => apiGet<LessonPreviewDto>(`/courses/${slug}/lessons/${lessonId}/preview`),
    staleTime: 0,
    gcTime: 0, // contains a short-lived signed link
  });
  const l = q.data;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={l?.title ?? t('curriculum.previewTitle')}
      className="max-w-3xl"
    >
      {q.isPending ? (
        <Skeleton className="aspect-video w-full" />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          {l!.summary && <p className="text-sm text-muted-foreground">{l!.summary}</p>}
          {l!.type === 'video' &&
            l!.mediaUrl &&
            (l!.mediaUrl.startsWith('/api/') ? (
              <video
                src={l!.mediaUrl}
                controls
                preload="metadata"
                className="aspect-video w-full rounded-md bg-black"
              />
            ) : (
              <a
                href={l!.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline"
              >
                {l!.mediaUrl}
              </a>
            ))}
          {l!.type === 'pdf' && l!.mediaUrl && (
            <a
              href={l!.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-semibold text-primary underline"
            >
              <FontAwesomeIcon icon={faFilePdf} aria-hidden /> {t('curriculum.openPdf')}
            </a>
          )}
          {l!.content && (
            <div className="max-h-[50vh] overflow-y-auto whitespace-pre-line leading-relaxed text-foreground/90">
              {l!.content}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
