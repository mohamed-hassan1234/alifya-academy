import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import type { Permission } from '@alifya/shared';
import { EmptyState } from '@/components/shared';
import { Skeleton } from '@/components/ui/feedback';
import { useAuth } from './AuthProvider';

function FullPageLoader() {
  return (
    <div className="container py-16" aria-busy="true">
      <Skeleton className="mb-4 h-8 w-64" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/** Requires an authenticated user. UX only — every protected API call is authorised server-side. */
export function ProtectedRoute() {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Redirects already-signed-in users away from login/register screens. */
export function GuestOnlyRoute() {
  const { user, initializing } = useAuth();
  if (initializing) return <FullPageLoader />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function Forbidden() {
  const { t } = useTranslation();
  return (
    <div className="py-10">
      <EmptyState icon={faLock} title={t('errors.forbiddenTitle')} description={t('errors.forbiddenBody')} />
    </div>
  );
}

/** Renders children only when the user holds ALL (default) or ANY of the given permissions. */
export function PermissionGuard({
  all,
  any,
  children,
  fallback = <Forbidden />,
}: {
  all?: Permission[];
  any?: Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user } = useAuth();
  const held = new Set(user?.permissions ?? []);
  const ok = (all ?? []).every((p) => held.has(p)) && (!any || any.some((p) => held.has(p)));
  return <>{ok ? children : fallback}</>;
}
