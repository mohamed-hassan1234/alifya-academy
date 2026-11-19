import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faChevronDown,
  faEnvelope,
  faGlobe,
  faLocationDot,
  faPhone,
  faRightFromBracket,
  faTableColumns,
} from '@fortawesome/free-solid-svg-icons';
import {
  faFacebookF,
  faInstagram,
  faLinkedinIn,
  faTiktok,
  faXTwitter,
  faYoutube,
} from '@fortawesome/free-brands-svg-icons';
import { Brand } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/dialog';
import { dashboardPathFor, useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { FALLBACK_SETTINGS, useSiteSettings } from '@/lib/queries';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/about', key: 'nav.about', end: false },
  { to: '/courses', key: 'nav.courses', end: false },
  { to: '/roadmaps', key: 'nav.roadmaps', end: false },
  { to: '/webinars', key: 'nav.webinars', end: false },
  { to: '/programs', key: 'nav.programs', end: false },
  { to: '/instructors', key: 'nav.instructors', end: false },
  { to: '/contact', key: 'nav.contact', end: false },
] as const;

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const next = i18n.language === 'so' ? 'en' : 'so';
  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(next)}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-primary hover:bg-mint',
        className,
      )}
      aria-label={`${t('common.language')}: ${t(`languages.${next}`)}`}
    >
      <FontAwesomeIcon icon={faGlobe} aria-hidden />
      {next.toUpperCase()}
    </button>
  );
}

export function UserMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const initials = user.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex h-10 items-center gap-2 rounded-md pl-1 pr-2 text-sm font-semibold text-primary hover:bg-mint">
        <span
          className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs text-brand-foreground"
          aria-hidden
        >
          {initials}
        </span>
        <span className="hidden max-w-[10rem] truncate md:inline">{user.fullName}</span>
        <FontAwesomeIcon icon={faChevronDown} className="text-xs" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-52 rounded-md border border-border bg-background p-1.5 shadow-card"
        >
          <div className="px-2.5 py-2 text-xs text-muted-foreground">{user.email}</div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            onSelect={() => navigate(dashboardPathFor(user))}
            className="flex cursor-pointer items-center gap-2.5 rounded px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-mint"
          >
            <FontAwesomeIcon icon={faTableColumns} className="w-4 text-muted-foreground" aria-hidden />{' '}
            {t('nav.dashboard')}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => navigate('/student/profile')}
            className="flex cursor-pointer items-center gap-2.5 rounded px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-mint"
          >
            <FontAwesomeIcon icon={faEnvelope} className="w-4 text-muted-foreground" aria-hidden />{' '}
            {t('nav.profile')}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            onSelect={() => void logout().then(() => navigate('/'))}
            className="flex cursor-pointer items-center gap-2.5 rounded px-2.5 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger/5"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="w-4" aria-hidden /> {t('nav.logout')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SiteHeader() {
  const { t } = useTranslation();
  const { user, initializing } = useAuth();
  const { data: settings = FALLBACK_SETTINGS } = useSiteSettings();
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative py-2 text-sm font-semibold transition-colors hover:text-primary',
      isActive ? 'text-primary' : 'text-muted-foreground',
    );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="container flex h-16 items-center justify-between gap-4 md:h-[4.5rem]">
        <Link to="/" className="shrink-0" aria-label={`${settings.academyName} — ${t('nav.home')}`}>
          <Brand name={settings.academyName} logoUrl={settings.logoUrl} />
        </Link>
        {/* The logo links home, so "Home" is left out of the desktop bar (it stays in the mobile menu). */}
        <nav aria-label={t('nav.primary')} className="hidden items-center gap-5 xl:flex 2xl:gap-7">
          {NAV.filter((n) => n.to !== '/').map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <ThemeToggle />
          <LanguageSwitcher />
          {!initializing &&
            (user ? (
              <UserMenu />
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">{t('nav.login')}</Link>
                </Button>
                <Button asChild>
                  <Link to="/register">{t('nav.register')}</Link>
                </Button>
              </>
            ))}
        </div>
        <div className="flex items-center gap-1 xl:hidden">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label={t('common.menu')}
            aria-expanded={open}
          >
            <FontAwesomeIcon icon={faBars} className="text-lg" />
          </Button>
        </div>
      </div>

      {/* MobileNavigation */}
      <Drawer open={open} onOpenChange={setOpen} title={settings.academyName}>
        <nav aria-label={t('nav.primary')} className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-3 font-semibold',
                  isActive ? 'bg-mint text-primary' : 'text-foreground hover:bg-mint',
                )
              }
            >
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
          {user ? (
            <Button asChild onClick={() => setOpen(false)}>
              <Link to={dashboardPathFor(user)}>{t('nav.dashboard')}</Link>
            </Button>
          ) : (
            <>
              <Button asChild onClick={() => setOpen(false)}>
                <Link to="/register">{t('nav.register')}</Link>
              </Button>
              <Button variant="secondary" asChild onClick={() => setOpen(false)}>
                <Link to="/login">{t('nav.login')}</Link>
              </Button>
            </>
          )}
          <LanguageSwitcher className="justify-center" />
        </div>
      </Drawer>
    </header>
  );
}

const SOCIAL_ICONS = {
  facebook: faFacebookF,
  instagram: faInstagram,
  linkedin: faLinkedinIn,
  x: faXTwitter,
  youtube: faYoutube,
  tiktok: faTiktok,
};

function SiteFooter() {
  const { t } = useTranslation();
  const { data: s = FALLBACK_SETTINGS } = useSiteSettings();
  const socials = Object.entries(s.social).filter(([, url]) => !!url) as [
    keyof typeof SOCIAL_ICONS,
    string,
  ][];
  const hasContact = !!(s.contact.email || s.contact.phones.length || s.contact.address);

  return (
    <footer className="mt-auto bg-brand text-white/80 dark:bg-ivory dark:border-t dark:border-border">
      <div className="container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Brand name={s.academyName} logoUrl={s.logoUrl} inverted />
          {(s.tagline || s.about.summary) && (
            <p className="mt-4 max-w-sm text-sm leading-relaxed">{s.tagline || s.about.summary}</p>
          )}
          {socials.length > 0 && (
            <ul className="mt-6 flex gap-2">
              {socials.map(([k, url]) => (
                <li key={k}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={k}
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/20 hover:border-accent hover:text-accent"
                  >
                    <FontAwesomeIcon icon={SOCIAL_ICONS[k]} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">
            {t('footer.explore')}
          </p>
          <ul className="space-y-2.5 text-sm">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="hover:text-white">
                  {t(n.key)}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/register" className="hover:text-white">
                {t('nav.register')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">
            {t('footer.contact')}
          </p>
          {hasContact ? (
            <ul className="space-y-3 text-sm">
              {s.contact.email && (
                <li className="flex gap-3">
                  <FontAwesomeIcon icon={faEnvelope} className="mt-0.5 text-accent" aria-hidden />
                  <a href={`mailto:${s.contact.email}`} className="hover:text-white">
                    {s.contact.email}
                  </a>
                </li>
              )}
              {s.contact.phones.map((p) => (
                <li key={p} className="flex gap-3">
                  <FontAwesomeIcon icon={faPhone} className="mt-0.5 text-accent" aria-hidden />
                  <a href={`tel:${p.replace(/\s/g, '')}`} className="hover:text-white">
                    {p}
                  </a>
                </li>
              ))}
              {s.contact.address && (
                <li className="flex gap-3">
                  <FontAwesomeIcon icon={faLocationDot} className="mt-0.5 text-accent" aria-hidden />
                  <span>{s.contact.address}</span>
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm">{t('footer.contactPending')}</p>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container py-5 text-xs text-white/60">
          {t('footer.rights', { year: new Date().getFullYear(), name: s.academyName })}
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {t('common.skipToContent')}
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
