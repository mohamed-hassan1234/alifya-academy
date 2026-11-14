import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDown,
  faArrowUp,
  faBookOpen,
  faEye,
  faFilePdf,
  faPen,
  faPlay,
  faPlus,
  faTrash,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons';
import {
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  VIDEO_TYPES,
  type LessonResourceDto,
  type ManagedCurriculumDto,
  type ManagedLessonDto,
} from '@alifya/shared';
import { DashboardPageHeader } from '@/components/layout/DashboardLayout';
import { BackLink, EmptyState, ErrorState, FormField, useConfirm } from '@/components/shared';
import { TableSkeleton } from '@/components/shared/DataTable';
import { FileUploader } from '@/components/shared/Uploaders';
import { useToast } from '@/components/shared/toast';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { AlertMessage, Badge } from '@/components/ui/feedback';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/form-controls';
import { apiDelete, apiGet, apiMediaLink, apiPatch, apiPost, normalizeError } from '@/lib/api';
import { usePageMeta } from '@/lib/seo';

const TYPE_ICON = { text: faBookOpen, video: faPlay, pdf: faFilePdf } as const;
const TYPE_LABEL = { text: 'Text / reading', video: 'Video', pdf: 'PDF document' } as const;

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

async function openMedia(mediaId: string) {
  // Private files open through a short-lived signed link, never a reusable URL.
  const url = await apiMediaLink(mediaId);
  window.open(url, '_blank', 'noopener');
}

export function CurriculumManagerPage({ backTo }: { backTo: (courseId: string) => string }) {
  const { id: courseId = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const key = ['curriculum-manage', courseId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => apiGet<ManagedCurriculumDto>(`/curriculum/courses/${courseId}`),
  });
  const [newSection, setNewSection] = useState('');
  const [editingSection, setEditingSection] = useState<{ id: string; title: string } | null>(null);
  const [lessonEditor, setLessonEditor] = useState<{ sectionId: string; lesson?: ManagedLessonDto } | null>(
    null,
  );
  usePageMeta({ title: q.data ? `Curriculum · ${q.data.course.title}` : 'Curriculum', noindex: true });

  const onError = (err: unknown) => toast(normalizeError(err).message, 'danger');
  const setData = (d: ManagedCurriculumDto) => qc.setQueryData(key, d);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const addSection = useMutation({
    mutationFn: () =>
      apiPost<ManagedCurriculumDto>(`/curriculum/courses/${courseId}/sections`, { title: newSection }),
    onSuccess: (d) => {
      setData(d);
      setNewSection('');
      toast('Section added.');
    },
    onError,
  });
  const renameSection = useMutation({
    mutationFn: (s: { id: string; title: string }) =>
      apiPatch<ManagedCurriculumDto>(`/curriculum/sections/${s.id}`, { title: s.title }),
    onSuccess: (d) => {
      setData(d);
      setEditingSection(null);
    },
    onError,
  });
  const generic = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => void refresh(),
    onError,
  });

  if (q.isPending) return <TableSkeleton rows={6} />;
  if (q.isError) {
    const e = normalizeError(q.error);
    return e.status === 403 ? (
      <EmptyState title="You can only manage courses assigned to you." />
    ) : (
      <ErrorState onRetry={() => void q.refetch()} />
    );
  }
  const { course, sections, can } = q.data;

  return (
    <>
      {dialog}
      <BackLink to={backTo(course.id)}>Back</BackLink>
      <div className="mt-4">
        <DashboardPageHeader
          title={course.title}
          description="Organise sections and lessons. Only published lessons are visible to learners; preview lessons are also visible to website visitors."
        />
      </div>
      {!can.edit && (
        <AlertMessage className="mb-6">You have read-only access to this curriculum.</AlertMessage>
      )}

      {sections.length === 0 && (
        <EmptyState
          title="No sections yet."
          description="Start by adding the first section (for example “Week 1” or “Introduction”)."
        />
      )}

      <ol className="flex flex-col gap-5">
        {sections.map((s, si) => (
          <li key={s.id} className="rounded-lg border border-border bg-background">
            <div className="flex flex-col gap-3 border-b border-border bg-ivory px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              {editingSection?.id === s.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    renameSection.mutate(editingSection);
                  }}
                >
                  <label htmlFor={`sec-${s.id}`} className="sr-only">
                    Section title
                  </label>
                  <Input
                    id={`sec-${s.id}`}
                    value={editingSection.title}
                    onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                    autoFocus
                  />
                  <Button type="submit" size="sm" loading={renameSection.isPending}>
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingSection(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <h2 className="font-display text-lg text-primary">
                  <span className="mr-2 text-muted-foreground">{si + 1}.</span>
                  {s.title}
                </h2>
              )}
              {can.edit && editingSection?.id !== s.id && (
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Move section up"
                    disabled={si === 0 || generic.isPending}
                    onClick={() =>
                      generic.mutate(() =>
                        apiPost(`/curriculum/courses/${courseId}/sections/reorder`, {
                          ids: move(sections, si, si - 1).map((x) => x.id),
                        }),
                      )
                    }
                  >
                    <FontAwesomeIcon icon={faArrowUp} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Move section down"
                    disabled={si === sections.length - 1 || generic.isPending}
                    onClick={() =>
                      generic.mutate(() =>
                        apiPost(`/curriculum/courses/${courseId}/sections/reorder`, {
                          ids: move(sections, si, si + 1).map((x) => x.id),
                        }),
                      )
                    }
                  >
                    <FontAwesomeIcon icon={faArrowDown} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Rename section"
                    onClick={() => setEditingSection({ id: s.id, title: s.title })}
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-danger"
                    aria-label="Delete section"
                    onClick={async () => {
                      if (
                        await confirm(
                          'Delete section',
                          `Delete “${s.title}”? Sections must be empty before they can be deleted.`,
                          true,
                        )
                      )
                        generic.mutate(() => apiDelete(`/curriculum/sections/${s.id}`));
                    }}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </Button>
                </div>
              )}
            </div>

            <ul className="divide-y divide-border">
              {s.lessons.length === 0 && (
                <li className="px-4 py-4 text-sm text-muted-foreground">No lessons in this section yet.</li>
              )}
              {s.lessons.map((l, li) => (
                <li
                  key={l.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FontAwesomeIcon
                      icon={TYPE_ICON[l.type]}
                      className="w-4 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{l.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge tone={l.publicationStatus === 'published' ? 'success' : 'neutral'}>
                          {l.publicationStatus === 'published' ? 'Published' : 'Draft'}
                        </Badge>
                        {l.isPreview && (
                          <Badge tone="accent">
                            <FontAwesomeIcon icon={faEye} aria-hidden /> Public preview
                          </Badge>
                        )}
                        {l.durationMinutes ? <Badge>{l.durationMinutes} min</Badge> : null}
                      </div>
                    </div>
                  </div>
                  {can.edit && (
                    <div className="flex flex-wrap gap-1 pl-7 sm:pl-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Move lesson up"
                        disabled={li === 0 || generic.isPending}
                        onClick={() =>
                          generic.mutate(() =>
                            apiPost(`/curriculum/sections/${s.id}/lessons/reorder`, {
                              ids: move(s.lessons, li, li - 1).map((x) => x.id),
                            }),
                          )
                        }
                      >
                        <FontAwesomeIcon icon={faArrowUp} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Move lesson down"
                        disabled={li === s.lessons.length - 1 || generic.isPending}
                        onClick={() =>
                          generic.mutate(() =>
                            apiPost(`/curriculum/sections/${s.id}/lessons/reorder`, {
                              ids: move(s.lessons, li, li + 1).map((x) => x.id),
                            }),
                          )
                        }
                      >
                        <FontAwesomeIcon icon={faArrowDown} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLessonEditor({ sectionId: s.id, lesson: l })}
                      >
                        <FontAwesomeIcon icon={faPen} aria-hidden /> Edit
                      </Button>
                      {can.publish && (
                        <Button
                          size="sm"
                          variant={l.publicationStatus === 'published' ? 'ghost' : 'secondary'}
                          disabled={generic.isPending}
                          onClick={() =>
                            generic.mutate(() =>
                              apiPost(
                                `/curriculum/lessons/${l.id}/${l.publicationStatus === 'published' ? 'unpublish' : 'publish'}`,
                              ),
                            )
                          }
                        >
                          {l.publicationStatus === 'published' ? 'Unpublish' : 'Publish'}
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-danger"
                        aria-label="Delete lesson"
                        onClick={async () => {
                          if (await confirm('Delete lesson', `Delete “${l.title}”?`, true))
                            generic.mutate(() => apiDelete(`/curriculum/lessons/${l.id}`));
                        }}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {can.edit && (
              <div className="border-t border-border px-4 py-3">
                <Button size="sm" variant="secondary" onClick={() => setLessonEditor({ sectionId: s.id })}>
                  <FontAwesomeIcon icon={faPlus} aria-hidden /> Add lesson
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>

      {can.edit && (
        <form
          className="mt-6 flex flex-col gap-2 rounded-lg border border-dashed border-border bg-background p-4 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (newSection.trim().length >= 2) addSection.mutate();
          }}
        >
          <label htmlFor="new-section" className="sr-only">
            New section title
          </label>
          <Input
            id="new-section"
            value={newSection}
            onChange={(e) => setNewSection(e.target.value)}
            placeholder="New section title, e.g. Week 1 — Foundations"
            maxLength={160}
          />
          <Button type="submit" loading={addSection.isPending} disabled={newSection.trim().length < 2}>
            <FontAwesomeIcon icon={faPlus} aria-hidden /> Add section
          </Button>
        </form>
      )}

      {lessonEditor && (
        <LessonEditor
          courseId={courseId}
          sections={sections.map((s) => ({ id: s.id, title: s.title }))}
          sectionId={lessonEditor.sectionId}
          lesson={lessonEditor.lesson}
          onClose={() => setLessonEditor(null)}
          onSaved={() => {
            toast('Lesson saved.');
            setLessonEditor(null);
            void refresh();
          }}
        />
      )}
    </>
  );
}

interface LessonForm {
  sectionId: string;
  title: string;
  type: 'text' | 'video' | 'pdf';
  summary: string;
  content: string;
  videoUrl: string;
  durationMinutes: string;
  isPreview: boolean;
}

function LessonEditor({
  courseId,
  sections,
  sectionId,
  lesson,
  onClose,
  onSaved,
}: {
  courseId: string;
  sections: { id: string; title: string }[];
  sectionId: string;
  lesson?: ManagedLessonDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [videoMediaId, setVideoMediaId] = useState<string | null>(lesson?.videoMediaId ?? null);
  const [pdfMediaId, setPdfMediaId] = useState<string | null>(lesson?.pdfMediaId ?? null);
  const [resources, setResources] = useState<LessonResourceDto[]>(lesson?.resources ?? []);
  const [banner, setBanner] = useState<string | null>(null);
  const form = useForm<LessonForm>({
    defaultValues: {
      sectionId: lesson?.sectionId ?? sectionId,
      title: lesson?.title ?? '',
      type: lesson?.type ?? 'text',
      summary: lesson?.summary ?? '',
      content: lesson?.content ?? '',
      videoUrl: lesson?.videoUrl ?? '',
      durationMinutes: lesson?.durationMinutes?.toString() ?? '',
      isPreview: lesson?.isPreview ?? false,
    },
  });
  const type = form.watch('type');
  const e = form.formState.errors;

  const submit = form.handleSubmit(async (v) => {
    setBanner(null);
    const body = {
      sectionId: v.sectionId,
      title: v.title,
      type: v.type,
      summary: v.summary,
      content: v.content,
      videoMediaId: v.type === 'video' ? videoMediaId : null,
      videoUrl: v.type === 'video' && !videoMediaId && v.videoUrl ? v.videoUrl : null,
      pdfMediaId: v.type === 'pdf' ? pdfMediaId : null,
      resources,
      durationMinutes: v.durationMinutes ? Number(v.durationMinutes) : null,
      isPreview: v.isPreview,
    };
    try {
      if (lesson) await apiPatch(`/curriculum/lessons/${lesson.id}`, body);
      else await apiPost(`/curriculum/courses/${courseId}/lessons`, body);
      onSaved();
    } catch (err) {
      const n = normalizeError(err);
      for (const [f, m] of Object.entries(n.fields)) form.setError(f as keyof LessonForm, { message: m });
      setBanner(n.fields.pdfMediaId ?? n.fields.resources ?? n.message);
    }
  });

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={lesson ? 'Edit lesson' : 'New lesson'}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={form.formState.isSubmitting}>
            Save lesson
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {banner && <AlertMessage tone="danger">{banner}</AlertMessage>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Title" error={e.title?.message} className="sm:col-span-2">
            <Input {...form.register('title')} />
          </FormField>
          <FormField label="Section">
            <Select {...form.register('sectionId')}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Lesson type">
            <Select {...form.register('type')}>
              {(['text', 'video', 'pdf'] as const).map((tp) => (
                <option key={tp} value={tp}>
                  {TYPE_LABEL[tp]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Short summary" error={e.summary?.message} className="sm:col-span-2">
            <Input {...form.register('summary')} maxLength={500} />
          </FormField>
        </div>

        {type === 'video' && (
          <div className="flex flex-col gap-3 rounded-md border border-border p-4">
            <p className="text-sm font-semibold">Video</p>
            {videoMediaId ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone="success">Video uploaded</Badge>
                <Button type="button" size="sm" variant="ghost" onClick={() => void openMedia(videoMediaId)}>
                  <FontAwesomeIcon icon={faUpRightFromSquare} aria-hidden /> Open
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setVideoMediaId(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <>
                <FileUploader
                  label="Upload video (MP4 or WebM)"
                  purpose="lesson_resource"
                  accept={VIDEO_TYPES.join(',')}
                  onUploaded={(a) => setVideoMediaId(a.id)}
                />
                <FormField label="…or an https link to the video" error={e.videoUrl?.message}>
                  <Input type="url" placeholder="https://" {...form.register('videoUrl')} />
                </FormField>
              </>
            )}
          </div>
        )}

        {type === 'pdf' && (
          <div className="flex flex-col gap-3 rounded-md border border-border p-4">
            <p className="text-sm font-semibold">PDF document</p>
            {pdfMediaId ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone="success">PDF uploaded</Badge>
                <Button type="button" size="sm" variant="ghost" onClick={() => void openMedia(pdfMediaId)}>
                  <FontAwesomeIcon icon={faUpRightFromSquare} aria-hidden /> Open
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setPdfMediaId(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <FileUploader
                label="Upload PDF"
                purpose="lesson_resource"
                accept="application/pdf"
                onUploaded={(a) => setPdfMediaId(a.id)}
              />
            )}
          </div>
        )}

        <FormField
          label={type === 'text' ? 'Lesson content' : 'Notes for learners (optional)'}
          error={e.content?.message}
        >
          <Textarea rows={type === 'text' ? 10 : 4} {...form.register('content')} />
        </FormField>

        <div className="flex flex-col gap-3 rounded-md border border-border p-4">
          <p className="text-sm font-semibold">Downloadable resources</p>
          {resources.length > 0 && (
            <ul className="flex flex-col gap-2">
              {resources.map((r, i) => (
                <li key={r.mediaId} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label htmlFor={`res-${i}`} className="sr-only">
                    Resource title
                  </label>
                  <Input
                    id={`res-${i}`}
                    value={r.title}
                    onChange={(ev) =>
                      setResources((rs) => rs.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)))
                    }
                  />
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => void openMedia(r.mediaId)}>
                      Open
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => setResources((rs) => rs.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <FileUploader
            label="Add resource (PDF, Word, PowerPoint, Excel, image)"
            purpose="lesson_resource"
            accept={[...DOCUMENT_TYPES, ...IMAGE_TYPES].join(',')}
            onUploaded={(a) =>
              setResources((rs) => [...rs, { mediaId: a.id, title: a.originalName.replace(/\.[^.]+$/, '') }])
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <FormField label="Duration (minutes)" error={e.durationMinutes?.message}>
            <Input type="number" min="0" inputMode="numeric" {...form.register('durationMinutes')} />
          </FormField>
          <label className="flex items-center gap-3 text-sm sm:pb-3">
            <Checkbox {...form.register('isPreview')} /> Free public preview on the course page
          </label>
        </div>
      </form>
    </Modal>
  );
}
