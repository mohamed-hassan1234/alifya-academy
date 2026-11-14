import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPlus } from '@fortawesome/free-solid-svg-icons';
import {
  USER_STATUSES,
  type AdminUserRow,
  type AuditLogEntry,
  type CategoryDto,
  type Permission,
  type PermissionInfo,
  type PublicSiteSettings,
  type RoleDetail,
  type UserStatus,
} from '@alifya/shared';
import { DashboardPageHeader, useVisibleNav } from '@/components/layout/DashboardLayout';
import { EmptyState, ErrorState, FormField, Pagination, StatusBadge } from '@/components/shared';
import { DataTable, TableSkeleton } from '@/components/shared/DataTable';
import { useToast } from '@/components/shared/toast';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { AlertMessage, Badge } from '@/components/ui/feedback';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/form-controls';
import { applyServerErrors } from '@/features/auth/AuthCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { apiDelete, apiGet, apiGetPaged, apiPatch, apiPost, apiPut, normalizeError } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import { usePageMeta } from '@/lib/seo';

/** /admin → first module the user may access (no fabricated overview metrics). */
export function AdminIndexRedirect() {
  const groups = useVisibleNav();
  const admin = groups.find((g) => g.titleKey === 'admin.area');
  return <Navigate to={admin?.items[0]?.to ?? '/student/dashboard'} replace />;
}

/* ============================== Categories ============================== */
interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  order: number;
  isActive: boolean;
}

export function AdminCategoriesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<CategoryDto | 'new' | null>(null);
  usePageMeta({ title: t('admin.categories'), noindex: true });
  const list = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => apiGet<CategoryDto[]>('/admin/categories'),
  });
  const form = useForm<CategoryForm>();
  useEffect(() => {
    if (editing) {
      const c = editing === 'new' ? null : editing;
      form.reset({
        name: c?.name ?? '',
        slug: c?.slug ?? '',
        description: c?.description ?? '',
        order: c?.order ?? 0,
        isActive: c?.isActive ?? true,
      });
    }
  }, [editing, form]);

  const save = form.handleSubmit(async (v) => {
    const body = { ...v, slug: v.slug || undefined, order: Number(v.order) };
    try {
      if (editing === 'new') await apiPost('/admin/categories', body);
      else if (editing) await apiPatch(`/admin/categories/${editing.id}`, body);
      void qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      void qc.invalidateQueries({ queryKey: queryKeys.categories });
      toast(t('admin.saved'));
      setEditing(null);
    } catch (err) {
      applyServerErrors(err, form.setError);
    }
  });

  return (
    <>
      <DashboardPageHeader
        title={t('admin.categories')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <FontAwesomeIcon icon={faPlus} aria-hidden /> {t('admin.newCategory')}
          </Button>
        }
      />
      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title={t('admin.newCategory')} />
      ) : (
        <DataTable
          caption={t('admin.categories')}
          rows={list.data}
          rowKey={(c) => c.id}
          columns={[
            {
              key: 'name',
              header: t('admin.name'),
              cell: (c) => <span className="font-semibold">{c.name}</span>,
            },
            {
              key: 'slug',
              header: 'Slug',
              hideBelow: 'sm',
              cell: (c) => <code className="text-xs">{c.slug}</code>,
            },
            { key: 'order', header: t('admin.order'), hideBelow: 'md', cell: (c) => c.order },
            {
              key: 'active',
              header: t('admin.status'),
              cell: (c) => (
                <Badge tone={c.isActive ? 'success' : 'neutral'}>
                  {c.isActive ? t('status.active') : t('status.disabled')}
                </Badge>
              ),
            },
            {
              key: 'edit',
              header: t('common.actions'),
              className: 'text-right',
              cell: (c) => (
                <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                  <FontAwesomeIcon icon={faPen} aria-hidden /> Edit
                </Button>
              ),
            },
          ]}
        />
      )}
      <Modal
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? t('admin.newCategory') : t('admin.categories')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void save()} loading={form.formState.isSubmitting}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="flex flex-col gap-4" noValidate>
          <FormField label={t('admin.name')} error={form.formState.errors.name?.message}>
            <Input {...form.register('name')} />
          </FormField>
          <FormField label="Slug" hint="Leave empty to generate." error={form.formState.errors.slug?.message}>
            <Input {...form.register('slug')} />
          </FormField>
          <FormField label={t('admin.description')} error={form.formState.errors.description?.message}>
            <Textarea rows={3} {...form.register('description')} />
          </FormField>
          <FormField label={t('admin.order')} error={form.formState.errors.order?.message}>
            <Input type="number" min="0" {...form.register('order')} />
          </FormField>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox {...form.register('isActive')} /> {t('admin.activeCategory')}
          </label>
        </form>
      </Modal>
    </>
  );
}

/* ============================== Users ============================== */
export function AdminUsersPage() {
  const { t, i18n } = useTranslation();
  const { can, user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [statusTarget, setStatusTarget] = useState<AdminUserRow | null>(null);
  const [rolesTarget, setRolesTarget] = useState<AdminUserRow | null>(null);
  usePageMeta({ title: t('admin.users'), noindex: true });
  const filters = {
    page,
    q: params.get('q') || undefined,
    status: params.get('status') || undefined,
    role: params.get('role') || undefined,
  };
  const list = useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: () => apiGetPaged<AdminUserRow[]>('/admin/users', filters),
    placeholderData: keepPreviousData,
  });
  const roles = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => apiGet<RoleDetail[]>('/admin/roles'),
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
      <DashboardPageHeader title={t('admin.users')} />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setParam('q', q.trim());
          }}
        >
          <label htmlFor="user-q" className="sr-only">
            {t('common.search')}
          </label>
          <Input
            id="user-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`${t('admin.name')} / ${t('admin.email')}`}
          />
          <Button type="submit" variant="secondary">
            {t('common.search')}
          </Button>
        </form>
        <Select
          aria-label={t('admin.status')}
          value={params.get('status') ?? ''}
          onChange={(e) => setParam('status', e.target.value)}
        >
          <option value="">{t('admin.status')}</option>
          {USER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t('dashboard.roles')}
          value={params.get('role') ?? ''}
          onChange={(e) => setParam('role', e.target.value)}
        >
          <option value="">{t('dashboard.roles')}</option>
          {roles.data?.map((r) => (
            <option key={r.id} value={r.key}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title={t('admin.noUsers')} />
      ) : (
        <>
          <DataTable
            caption={t('admin.users')}
            rows={list.data.data}
            rowKey={(u) => u.id}
            columns={[
              {
                key: 'name',
                header: t('admin.name'),
                cell: (u) => (
                  <div>
                    <p className="font-semibold">{u.fullName}</p>
                    <p className="break-all text-xs text-muted-foreground">{u.email}</p>
                  </div>
                ),
              },
              {
                key: 'roles',
                header: t('dashboard.roles'),
                hideBelow: 'md',
                cell: (u) => (
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r.id}>{r.name}</Badge>
                    ))}
                  </div>
                ),
              },
              { key: 'status', header: t('admin.status'), cell: (u) => <StatusBadge status={u.status} /> },
              {
                key: 'login',
                header: t('admin.lastLogin'),
                hideBelow: 'lg',
                cell: (u) => (u.lastLoginAt ? formatDate(u.lastLoginAt, i18n.language) : t('admin.never')),
              },
              {
                key: 'actions',
                header: t('common.actions'),
                className: 'text-right',
                cell: (u) =>
                  u.id === me?.id ? null : (
                    <div className="flex justify-end gap-1">
                      {can('users.suspend') && (
                        <Button size="sm" variant="ghost" onClick={() => setStatusTarget(u)}>
                          {t('admin.changeStatus')}
                        </Button>
                      )}
                      {can('roles.manage') && (
                        <Button size="sm" variant="ghost" onClick={() => setRolesTarget(u)}>
                          {t('admin.editRoles')}
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
      {statusTarget && <StatusModal user={statusTarget} onClose={() => setStatusTarget(null)} />}
      {rolesTarget && roles.data && (
        <RolesModal user={rolesTarget} roles={roles.data} onClose={() => setRolesTarget(null)} />
      )}
    </>
  );
}

function StatusModal({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => apiPatch(`/admin/users/${user.id}/status`, { status, reason: reason || undefined }),
    onSuccess: () => {
      toast(t('admin.statusSaved'));
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('admin.changeStatus')}
      description={`${user.fullName} · ${user.email}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={status === 'suspended' || status === 'disabled' ? 'danger' : 'primary'}
            loading={m.isPending}
            onClick={() => m.mutate()}
          >
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {m.isError && <AlertMessage tone="danger">{normalizeError(m.error).message}</AlertMessage>}
        <FormField label={t('admin.status')}>
          <Select value={status} onChange={(e) => setStatus(e.target.value as UserStatus)}>
            {USER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('admin.reason')}>
          <Textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

function RolesModal({
  user,
  roles,
  onClose,
}: {
  user: AdminUserRow;
  roles: RoleDetail[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>(user.roles.map((r) => r.id));
  const m = useMutation({
    mutationFn: () => apiPut(`/admin/users/${user.id}/roles`, { roleIds: selected }),
    onSuccess: () => {
      toast(t('admin.rolesSaved'));
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
      onClose();
    },
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('admin.editRoles')}
      description={`${user.fullName} · ${user.email}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={m.isPending} disabled={!selected.length} onClick={() => m.mutate()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {m.isError && (
        <AlertMessage tone="danger" className="mb-4">
          {normalizeError(m.error).message}
        </AlertMessage>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t('dashboard.roles')}</legend>
        {roles.map((r) => (
          <label key={r.id} className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
            <Checkbox
              checked={selected.includes(r.id)}
              onChange={(e) =>
                setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))
              }
            />
            <span>
              <span className="font-semibold">{r.name}</span>
              <span className="block text-xs text-muted-foreground">{r.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}

/* ============================== Roles & permissions ============================== */
export function AdminRolesPage() {
  const { t } = useTranslation();
  usePageMeta({ title: t('admin.roles'), noindex: true });
  const roles = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => apiGet<RoleDetail[]>('/admin/roles'),
  });
  const perms = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => apiGet<PermissionInfo[]>('/admin/permissions'),
  });
  const [active, setActive] = useState<string | 'new' | null>(null);

  if (roles.isPending || perms.isPending) return <TableSkeleton rows={8} />;
  if (roles.isError || perms.isError)
    return <ErrorState onRetry={() => void Promise.all([roles.refetch(), perms.refetch()])} />;
  const current =
    active === 'new' ? null : (roles.data.find((r) => r.id === (active ?? roles.data[0]?.id)) ?? null);

  return (
    <>
      <DashboardPageHeader
        title={t('admin.roles')}
        actions={
          <Button onClick={() => setActive('new')}>
            <FontAwesomeIcon icon={faPlus} aria-hidden /> {t('admin.newRole')}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" role="list">
          {roles.data.map((r) => (
            <li key={r.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(r.id)}
                aria-current={current?.id === r.id}
                className={`w-full rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors ${current?.id === r.id ? 'border-primary bg-primary text-white' : 'border-border bg-background hover:bg-mint'}`}
              >
                <span className="block font-semibold">{r.name}</span>
                <span
                  className={`text-xs ${current?.id === r.id ? 'text-white/75' : 'text-muted-foreground'}`}
                >
                  {t('admin.usersCount', { count: r.userCount })}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <RoleEditor
          key={current?.id ?? 'new'}
          role={current}
          catalogue={perms.data}
          onCreated={(id) => setActive(id)}
          onDeleted={() => setActive(null)}
        />
      </div>
    </>
  );
}

function RoleEditor({
  role,
  catalogue,
  onCreated,
  onDeleted,
}: {
  role: RoleDetail | null;
  catalogue: PermissionInfo[];
  onCreated: (id: string) => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [perms, setPerms] = useState<Set<Permission>>(new Set(role?.permissions ?? []));
  const [meta, setMeta] = useState({ key: '', name: role?.name ?? '', description: role?.description ?? '' });
  const [error, setError] = useState<string | null>(null);
  const locked = role?.key === 'super_admin';
  const groups = catalogue.reduce<Record<string, PermissionInfo[]>>(
    (acc, p) => ((acc[p.group] ??= []).push(p), acc),
    {},
  );

  const save = useMutation({
    mutationFn: () =>
      role
        ? apiPatch<RoleDetail>(`/admin/roles/${role.id}`, {
            name: meta.name,
            description: meta.description,
            ...(locked ? {} : { permissions: [...perms] }),
          })
        : apiPost<RoleDetail>('/admin/roles', { ...meta, permissions: [...perms] }),
    onSuccess: (r) => {
      toast(t('admin.saved'));
      void qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
      if (!role) onCreated(r.id);
    },
    onError: (err) => {
      const e = normalizeError(err);
      setError(Object.values(e.fields)[0] ?? e.message);
    },
  });
  const del = useMutation({
    mutationFn: () => apiDelete(`/admin/roles/${role!.id}`),
    onSuccess: () => {
      toast(t('admin.saved'));
      void qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
      onDeleted();
    },
    onError: (err) => setError(normalizeError(err).message),
  });

  return (
    <section className="rounded-lg border border-border bg-background p-5 sm:p-6">
      {error && (
        <AlertMessage tone="danger" className="mb-4">
          {error}
        </AlertMessage>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {!role && (
          <FormField label={t('admin.roleKey')} hint="lowercase_with_underscores">
            <Input value={meta.key} onChange={(e) => setMeta({ ...meta, key: e.target.value })} />
          </FormField>
        )}
        <FormField label={t('admin.name')}>
          <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
        </FormField>
        <FormField label={t('admin.description')} className="md:col-span-2">
          <Input
            value={meta.description}
            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
          />
        </FormField>
      </div>
      {role?.isSystem && <Badge className="mt-4">{t('admin.system')}</Badge>}
      {locked && <AlertMessage className="mt-4">{t('admin.permissionsFixed')}</AlertMessage>}
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {Object.entries(groups).map(([group, items]) => (
          <fieldset key={group} className="rounded-md border border-border p-4" disabled={locked}>
            <legend className="px-1 text-sm font-semibold text-primary">{group}</legend>
            <div className="mt-1 flex flex-col gap-2">
              {items.map((p) => (
                <label key={p.key} className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    checked={locked || perms.has(p.key)}
                    onChange={(e) =>
                      setPerms((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(p.key);
                        else n.delete(p.key);
                        return n;
                      })
                    }
                  />
                  <span>
                    {p.description}
                    <code className="block text-[0.7rem] text-muted-foreground">{p.key}</code>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {role && !role.isSystem && (
          <Button
            variant="ghost"
            className="text-danger"
            loading={del.isPending}
            onClick={() => del.mutate()}
          >
            Delete role
          </Button>
        )}
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          {t('common.save')}
        </Button>
      </div>
    </section>
  );
}

/* ============================== Audit logs ============================== */
export function AdminAuditLogsPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const action = params.get('action') ?? '';
  const [draft, setDraft] = useState(action);
  usePageMeta({ title: t('admin.auditLogs'), noindex: true });
  const list = useQuery({
    queryKey: ['admin', 'audit', { page, action }],
    queryFn: () => apiGetPaged<AuditLogEntry[]>('/admin/audit-logs', { page, action: action || undefined }),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <DashboardPageHeader title={t('admin.auditLogs')} />
      <form
        role="search"
        className="mb-5 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(draft.trim() ? { action: draft.trim() } : {});
        }}
      >
        <label htmlFor="audit-action" className="sr-only">
          {t('admin.action')}
        </label>
        <Input
          id="audit-action"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. course. or auth.login"
        />
        <Button type="submit" variant="secondary">
          {t('common.search')}
        </Button>
      </form>
      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title={t('admin.noLogs')} />
      ) : (
        <>
          <DataTable
            caption={t('admin.auditLogs')}
            rows={list.data.data}
            rowKey={(r) => r.id}
            columns={[
              {
                key: 'when',
                header: t('admin.when'),
                cell: (r) => (
                  <span className="whitespace-nowrap text-xs">
                    {formatDateTime(r.createdAt, i18n.language)}
                  </span>
                ),
              },
              {
                key: 'action',
                header: t('admin.action'),
                cell: (r) => <code className="text-xs">{r.action}</code>,
              },
              {
                key: 'actor',
                header: t('admin.actor'),
                hideBelow: 'md',
                cell: (r) => r.actor?.fullName ?? '—',
              },
              {
                key: 'target',
                header: t('admin.target'),
                hideBelow: 'lg',
                cell: (r) => (r.targetType ? `${r.targetType} ${r.targetId?.slice(-6) ?? ''}` : '—'),
              },
              {
                key: 'outcome',
                header: t('admin.outcome'),
                cell: (r) => <Badge tone={r.outcome === 'success' ? 'success' : 'danger'}>{r.outcome}</Badge>,
              },
            ]}
          />
          <Pagination
            page={page}
            totalPages={list.data.meta.totalPages}
            onChange={(p) => setParams({ ...(action ? { action } : {}), page: String(p) })}
          />
        </>
      )}
    </>
  );
}

/* ============================== Site settings ============================== */
interface SettingsForm {
  academyName: string;
  tagline: string;
  logoUrl: string;
  email: string;
  phones: string;
  address: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  aboutSummary: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  x: string;
  youtube: string;
  tiktok: string;
}
const SOCIALS = ['facebook', 'instagram', 'linkedin', 'x', 'youtube', 'tiktok'] as const;

export function AdminSettingsPage() {
  const { t } = useTranslation();
  usePageMeta({ title: t('admin.settings'), noindex: true });
  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => apiGet<PublicSiteSettings>('/admin/settings'),
  });
  if (settings.isPending) return <TableSkeleton rows={8} />;
  if (settings.isError) return <ErrorState onRetry={() => void settings.refetch()} />;
  return <SettingsEditor initial={settings.data} />;
}

function SettingsEditor({ initial }: { initial: PublicSiteSettings }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SettingsForm>({
    defaultValues: {
      academyName: initial.academyName,
      tagline: initial.tagline,
      logoUrl: initial.logoUrl ?? '',
      email: initial.contact.email ?? '',
      phones: initial.contact.phones.join(', '),
      address: initial.contact.address ?? '',
      heroTitle: initial.hero.title ?? '',
      heroSubtitle: initial.hero.subtitle ?? '',
      heroImageUrl: initial.hero.imageUrl ?? '',
      aboutSummary: initial.about.summary ?? '',
      ...Object.fromEntries(SOCIALS.map((s) => [s, initial.social[s] ?? ''])),
    } as SettingsForm,
  });
  const n = (v: string) => (v.trim() ? v.trim() : null);
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const saved = await apiPatch<PublicSiteSettings>('/admin/settings', {
        academyName: v.academyName,
        tagline: v.tagline,
        logoUrl: n(v.logoUrl),
        contact: {
          email: n(v.email),
          phones: v.phones
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean),
          address: n(v.address),
        },
        hero: { title: n(v.heroTitle), subtitle: n(v.heroSubtitle), imageUrl: n(v.heroImageUrl) },
        about: { summary: n(v.aboutSummary) },
        social: Object.fromEntries(SOCIALS.map((s) => [s, n(v[s])])),
      });
      qc.setQueryData(queryKeys.settings, saved);
      qc.setQueryData(['admin', 'settings'], saved);
      toast(t('admin.saved'));
    } catch (err) {
      const e = normalizeError(err);
      setError(
        Object.entries(e.fields)
          .map(([k, m]) => `${k}: ${m}`)
          .join(' · ') || e.message,
      );
    }
  });
  return (
    <>
      <DashboardPageHeader title={t('admin.settings')} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {error && <AlertMessage tone="danger">{error}</AlertMessage>}
        {!initial.logoUrl && <AlertMessage tone="warning">{t('admin.logoPending')}</AlertMessage>}
        <section className="grid gap-5 rounded-lg border border-border bg-background p-6 md:grid-cols-2">
          <FormField label="Academy name">
            <Input {...form.register('academyName')} />
          </FormField>
          <FormField label="Official logo URL" hint="Use only the official supplied asset.">
            <Input type="url" {...form.register('logoUrl')} />
          </FormField>
          <FormField label="Tagline" className="md:col-span-2">
            <Input {...form.register('tagline')} />
          </FormField>
          <FormField label="About summary (footer)" className="md:col-span-2">
            <Textarea rows={3} {...form.register('aboutSummary')} />
          </FormField>
        </section>
        <section className="grid gap-5 rounded-lg border border-border bg-background p-6 md:grid-cols-2">
          <FormField label="Homepage hero title" hint="Empty = default translated text.">
            <Input {...form.register('heroTitle')} />
          </FormField>
          <FormField label="Homepage hero image URL">
            <Input type="url" {...form.register('heroImageUrl')} />
          </FormField>
          <FormField label="Homepage hero subtitle" className="md:col-span-2">
            <Textarea rows={2} {...form.register('heroSubtitle')} />
          </FormField>
        </section>
        <section className="grid gap-5 rounded-lg border border-border bg-background p-6 md:grid-cols-2">
          <FormField label="Contact email">
            <Input type="email" {...form.register('email')} />
          </FormField>
          <FormField label="Phone numbers" hint="Comma-separated">
            <Input {...form.register('phones')} />
          </FormField>
          <FormField label="Address" className="md:col-span-2">
            <Input {...form.register('address')} />
          </FormField>
          {SOCIALS.map((s) => (
            <FormField key={s} label={s === 'x' ? 'X (Twitter)' : s[0]!.toUpperCase() + s.slice(1)}>
              <Input type="url" placeholder="https://" {...form.register(s)} />
            </FormField>
          ))}
        </section>
        <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
          {t('common.save')}
        </Button>
      </form>
    </>
  );
}
