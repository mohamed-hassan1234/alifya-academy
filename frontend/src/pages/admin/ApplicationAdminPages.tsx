import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { APPLICATION_STATUSES, type AdminApplicationDto, type ApplicationStatus } from '@alifya/shared';
import { DashboardPageHeader } from '@/components/layout/DashboardLayout';
import { EmptyState, ErrorState, Pagination } from '@/components/shared';
import { DataTable, TableSkeleton } from '@/components/shared/DataTable';
import { useToast } from '@/components/shared/toast';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/form-controls';
import { useAuth } from '@/features/auth/AuthProvider';
import { apiGetPaged, apiPost, normalizeError } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { usePageMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';

const LABEL: Record<ApplicationStatus, string> = {
  submitted: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
const TONE: Record<ApplicationStatus, string> = {
  submitted: 'border-info/30 bg-info/10 text-info',
  approved: 'border-success/30 bg-success/10 text-success',
  rejected: 'border-border bg-mint text-muted-foreground',
  withdrawn: 'border-border bg-mint text-muted-foreground',
};

export function AdminApplicationsPage() {
  const { i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = (params.get('status') ?? 'submitted') as ApplicationStatus | '';
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  const [deciding, setDeciding] = useState<{
    app: AdminApplicationDto;
    decision: 'approve' | 'reject';
  } | null>(null);
  const [note, setNote] = useState('');
  usePageMeta({ title: 'Applications', noindex: true });

  const list = useQuery({
    queryKey: ['admin', 'applications', { page, status, q }],
    queryFn: () =>
      apiGetPaged<AdminApplicationDto[]>('/admin/applications', {
        page,
        status: status || undefined,
        q: q || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      apiPost(`/admin/applications/${id}/${decision}`, { note }),
    onSuccess: (_d, v) => {
      toast(v.decision === 'approve' ? 'Application approved.' : 'Application rejected.');
      setDeciding(null);
      setNote('');
      void qc.invalidateQueries({ queryKey: ['admin', 'applications'] });
    },
    onError: (err) => toast(normalizeError(err).message, 'danger'),
  });

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    next.delete('page');
    setParams(next);
  };
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    set({ q: draft.trim() });
  };

  return (
    <>
      <DashboardPageHeader
        title="Applications"
        description="Course applications from signed-in students. Approving a free course enrols the student; a paid course is admitted as awaiting payment."
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <Select
          aria-label="Status"
          className="sm:w-52"
          value={status}
          onChange={(e) => set({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LABEL[s]}
            </option>
          ))}
        </Select>
        <form onSubmit={onSearch} role="search" className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Student or course"
            aria-label="Search applications"
            className="sm:w-64"
          />
          <Button type="submit" variant="secondary" size="icon" aria-label="Search">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </Button>
        </form>
      </div>
      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          title={
            status === 'submitted' ? 'No applications are waiting for review.' : 'No applications found.'
          }
        />
      ) : (
        <>
          <DataTable
            caption="Applications"
            rows={list.data.data}
            rowKey={(a) => a.id}
            columns={[
              {
                key: 'student',
                header: 'Student',
                cell: (a) => (
                  <span>
                    <span className="font-semibold">{a.student.fullName}</span>
                    <span className="block text-xs text-muted-foreground">{a.student.email}</span>
                  </span>
                ),
              },
              {
                key: 'course',
                header: 'Course',
                cell: (a) => (
                  <span>
                    <Link
                      to={`/courses/${a.course.slug}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {a.course.title}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {a.course.isFree
                        ? 'Free'
                        : formatMoney(a.course.feeAmount, a.course.currency, i18n.language)}
                    </span>
                  </span>
                ),
              },
              {
                key: 'motivation',
                header: 'Motivation',
                hideBelow: 'lg',
                cell: (a) => (
                  <span className="line-clamp-2 max-w-xs text-sm text-muted-foreground">
                    {a.motivation || '—'}
                  </span>
                ),
              },
              {
                key: 'date',
                header: 'Submitted',
                hideBelow: 'md',
                cell: (a) => formatDateTime(a.submittedAt, i18n.language),
              },
              {
                key: 'status',
                header: 'Status',
                cell: (a) => (
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                      TONE[a.status],
                    )}
                  >
                    {LABEL[a.status]}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                className: 'text-right',
                cell: (a) =>
                  a.status === 'submitted' ? (
                    <div className="flex justify-end gap-1">
                      {can('applications.approve') && (
                        <Button size="sm" onClick={() => setDeciding({ app: a, decision: 'approve' })}>
                          Approve
                        </Button>
                      )}
                      {can('applications.reject') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger"
                          onClick={() => setDeciding({ app: a, decision: 'reject' })}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {a.decidedBy ? `by ${a.decidedBy.fullName}` : '—'}
                    </span>
                  ),
              },
            ]}
          />
          <Pagination
            page={page}
            totalPages={list.data.meta.totalPages}
            onChange={(p) => setParams({ ...Object.fromEntries(params), page: String(p) })}
          />
        </>
      )}

      <Modal
        open={!!deciding}
        onOpenChange={(o) => !o && setDeciding(null)}
        title={deciding?.decision === 'approve' ? 'Approve application' : 'Reject application'}
        description={deciding ? `${deciding.app.student.fullName} · ${deciding.app.course.title}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeciding(null)}>
              Cancel
            </Button>
            <Button
              variant={deciding?.decision === 'reject' ? 'danger' : 'primary'}
              loading={decide.isPending}
              onClick={() => deciding && decide.mutate({ id: deciding.app.id, decision: deciding.decision })}
            >
              {deciding?.decision === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        {deciding?.app.motivation && (
          <blockquote className="mb-4 rounded-md border-l-4 border-accent bg-ivory p-3 text-sm">
            {deciding.app.motivation}
          </blockquote>
        )}
        {deciding?.decision === 'approve' && (
          <p className="mb-4 text-sm text-muted-foreground">
            {deciding.app.course.isFree
              ? 'The student will be enrolled immediately and a seat will be taken.'
              : 'The student will be admitted as awaiting payment. They will not get access until payment is verified.'}
          </p>
        )}
        <Label htmlFor="decision-note">Note to the student (optional)</Label>
        <Textarea
          id="decision-note"
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2"
        />
      </Modal>
    </>
  );
}
