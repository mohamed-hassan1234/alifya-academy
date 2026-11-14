import { useId, useState, type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faChevronRight,
  faCircleExclamation,
  faFolderOpen,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import type { CourseDisplayStatus, UserStatus } from '@alifya/shared';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Badge, type BadgeProps } from '@/components/ui/feedback';
import { Label } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import { cloneElement, isValidElement } from 'react';

/* ---------------- Brand ---------------- */
/** Shows the official logo once configured in Site Settings; until then the academy NAME as text (no invented logo). */
export function Brand({
  name,
  logoUrl,
  inverted = false,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  inverted?: boolean;
  className?: string;
}) {
  if (logoUrl)
    return <img src={logoUrl} alt={name} className={cn('h-10 w-auto object-contain', className)} />;
  return (
    <span
      className={cn(
        'font-display text-[1.45rem] leading-none',
        inverted ? 'text-white' : 'text-primary',
        className,
      )}
    >
      {name}
    </span>
  );
}

/* ---------------- Headings ---------------- */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-border bg-ivory">
      <div className="container flex flex-col gap-4 py-10 sm:py-14 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
          <h1>{title}</h1>
          {description && <p className="mt-3 text-base text-muted-foreground sm:text-lg">{description}</p>}
        </div>
        {actions}
      </div>
    </header>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ---------------- States ---------------- */
export function EmptyState({
  title,
  description,
  action,
  icon = faFolderOpen,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: IconDefinition;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-ivory px-6 py-14 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-mint text-primary">
        <FontAwesomeIcon icon={icon} aria-hidden />
      </span>
      <p className="font-semibold text-primary">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-lg border border-danger/20 bg-danger/5 px-6 py-12 text-center"
    >
      <FontAwesomeIcon icon={faCircleExclamation} className="mb-3 text-2xl text-danger" aria-hidden />
      <p className="font-semibold text-foreground">{message ?? t('errors.generic')}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

/* ---------------- Status badges ---------------- */
const courseTones: Record<CourseDisplayStatus | 'published', BadgeProps['tone']> = {
  draft: 'neutral',
  published: 'info',
  archived: 'neutral',
  completed: 'neutral',
  in_progress: 'info',
  registration_open: 'success',
  registration_closed: 'warning',
};
const userTones: Record<UserStatus, BadgeProps['tone']> = {
  pending_verification: 'warning',
  active: 'success',
  suspended: 'danger',
  disabled: 'neutral',
};

export function StatusBadge({ status }: { status: CourseDisplayStatus | UserStatus | 'published' }) {
  const { t } = useTranslation();
  const tone =
    (courseTones as Record<string, BadgeProps['tone']>)[status] ??
    (userTones as Record<string, BadgeProps['tone']>)[status];
  return <Badge tone={tone}>{t(`status.${status}`)}</Badge>;
}

/* ---------------- Pagination ---------------- */
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <FontAwesomeIcon icon={faChevronLeft} aria-hidden /> {t('common.previous')}
      </Button>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {t('common.pageOf', { page, total: totalPages })}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        {t('common.next')} <FontAwesomeIcon icon={faChevronRight} aria-hidden />
      </Button>
    </nav>
  );
}

/* ---------------- Form field ---------------- */
/** Wires label, hint and error to the control via id / aria-describedby / aria-invalid. */
export function FormField({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactElement;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = isValidElement<Record<string, unknown>>(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
      })
    : children;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------------- Confirmation ---------------- */
export function useConfirm() {
  const { t } = useTranslation();
  const [state, setState] = useState<{
    title: string;
    body: string;
    danger?: boolean;
    resolve: (v: boolean) => void;
  } | null>(null);
  const confirm = (title: string, body: string, danger = false) =>
    new Promise<boolean>((resolve) => setState({ title, body, danger, resolve }));
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const dialog = (
    <Modal
      open={!!state}
      onOpenChange={(o) => !o && close(false)}
      title={state?.title ?? ''}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-foreground/85">{state?.body}</p>
    </Modal>
  );
  return { confirm, dialog };
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
    >
      <FontAwesomeIcon icon={faChevronLeft} aria-hidden /> {children}
    </Link>
  );
}
