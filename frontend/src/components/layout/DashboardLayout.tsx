import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faChalkboardUser,
  faEnvelope,
  faIdBadge,
  faLayerGroup,
  faRoute,
  faFileSignature,
  faMicrophoneLines,
  faBookOpen,
  faClipboardList,
  faGaugeHigh,
  faGear,
  faShieldHalved,
  faTags,
  faUser,
  faUsers,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import type { Permission } from '@alifya/shared';
import { Brand } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/dialog';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { FALLBACK_SETTINGS, useSiteSettings } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { LanguageSwitcher, UserMenu } from './PublicLayout';

interface NavItem {
  to: string;
  labelKey: string;
  icon: IconDefinition;
  /** Shown when the user holds ANY of these. Omitted = every signed-in user. */
  any?: Permission[];
  /** Shown when the user holds this role (ownership-scoped portals such as teaching). */
  role?: string;
}
interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

/** Navigation is generated from permissions; the API enforces the same rules independently. */
const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: 'dashboard.overview',
    items: [
      { to: '/student/dashboard', labelKey: 'nav.dashboard', icon: faGaugeHigh },
      { to: '/student/profile', labelKey: 'nav.profile', icon: faUser },
    ],
  },
  {
    titleKey: 'nav.instructorPortal',
    items: [
      {
        to: '/instructor/dashboard',
        labelKey: 'nav.instructorPortal',
        icon: faChalkboardUser,
        role: 'instructor',
      },
      { to: '/instructor/profile', labelKey: 'nav.teachingProfile', icon: faIdBadge, role: 'instructor' },
    ],
  },
  {
    titleKey: 'admin.area',
    items: [
      { to: '/admin/courses', labelKey: 'admin.courses', icon: faBookOpen, any: ['courses.read'] },
      {
        to: '/admin/categories',
        labelKey: 'admin.categories',
        icon: faTags,
        any: ['categories.manage', 'courses.update'],
      },
      { to: '/admin/programs', labelKey: 'nav.programs', icon: faLayerGroup, any: ['programs.manage'] },
      {
        to: '/admin/learning-paths',
        labelKey: 'nav.roadmaps',
        icon: faRoute,
        any: ['learning_paths.manage'],
      },
      {
        to: '/admin/webinars',
        labelKey: 'nav.webinars',
        icon: faMicrophoneLines,
        any: [
          'webinars.create',
          'webinars.update',
          'webinars.publish',
          'webinars.cancel',
          'webinar_registrations.manage',
        ],
      },
      {
        to: '/admin/applications',
        labelKey: 'nav.applications',
        icon: faFileSignature,
        any: ['applications.read'],
      },
      {
        to: '/admin/instructors',
        labelKey: 'nav.instructors',
        icon: faChalkboardUser,
        any: ['instructors.read', 'instructors.manage', 'users.read'],
      },
      { to: '/admin/users', labelKey: 'admin.users', icon: faUsers, any: ['users.read'] },
      { to: '/admin/roles', labelKey: 'admin.roles', icon: faShieldHalved, any: ['permissions.manage'] },
      {
        to: '/admin/audit-logs',
        labelKey: 'admin.auditLogs',
        icon: faClipboardList,
        any: ['audit_logs.read'],
      },
      {
        to: '/admin/contact-messages',
        labelKey: 'nav.contact',
        icon: faEnvelope,
        any: ['cms.manage', 'settings.manage'],
      },
      { to: '/admin/settings', labelKey: 'admin.settings', icon: faGear, any: ['settings.manage'] },
    ],
  },
];

export function useVisibleNav(): NavGroup[] {
  const { user } = useAuth();
  const held = new Set(user?.permissions ?? []);
  const roles = new Set(user?.roles.map((r) => r.key) ?? []);
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => (i.role ? roles.has(i.role) : !i.any || i.any.some((p) => held.has(p)))),
  })).filter((g) => g.items.length);
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const groups = useVisibleNav();
  return (
    <nav aria-label={t('nav.dashboard')} className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.titleKey}>
          <p className="mb-2 px-3 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {t(g.titleKey)}
          </p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((i) => (
              <li key={i.to}>
                <NavLink
                  to={i.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-brand text-brand-foreground'
                        : 'text-foreground/80 hover:bg-mint hover:text-primary',
                    )
                  }
                >
                  <FontAwesomeIcon icon={i.icon} className="w-4" aria-hidden />
                  {t(i.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DashboardLayout() {
  const { t } = useTranslation();
  const { data: s = FALLBACK_SETTINGS } = useSiteSettings();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-dvh bg-ivory">
      <a href="#main" className="skip-link">
        {t('common.skipToContent')}
      </a>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-background lg:flex">
        <Link to="/" className="flex h-16 items-center border-b border-border px-6">
          <Brand name={s.academyName} logoUrl={s.logoUrl} className="text-xl" />
        </Link>
        <div className="flex-1 overflow-y-auto p-4">
          <SidebarNav />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label={t('common.menu')}
            >
              <FontAwesomeIcon icon={faBars} />
            </Button>
            <Link to="/" className="lg:hidden">
              <Brand name={s.academyName} logoUrl={s.logoUrl} className="text-lg" />
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
      <Drawer open={open} onOpenChange={setOpen} title={s.academyName} side="left">
        <SidebarNav onNavigate={() => setOpen(false)} />
      </Drawer>
    </div>
  );
}

export function DashboardPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[1.75rem] sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
