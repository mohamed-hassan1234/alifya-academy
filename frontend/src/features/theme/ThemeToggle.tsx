import { useTranslation } from 'react-i18next';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faDesktop, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import { useTheme, type ThemePreference } from './ThemeProvider';

const OPTIONS: { value: ThemePreference; icon: typeof faSun; labelKey: string }[] = [
  { value: 'light', icon: faSun, labelKey: 'theme.light' },
  { value: 'dark', icon: faMoon, labelKey: 'theme.dark' },
  { value: 'system', icon: faDesktop, labelKey: 'theme.system' },
];

/** Light / Dark / System theme menu. The trigger shows the theme currently in effect. */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { preference, resolved, setPreference } = useTheme();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'grid h-10 w-10 place-items-center rounded-md text-primary transition-colors hover:bg-mint',
          className,
        )}
        aria-label={`${t('theme.label')}: ${t(`theme.${preference}`)}`}
      >
        <FontAwesomeIcon icon={resolved === 'dark' ? faMoon : faSun} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-40 rounded-md border border-border bg-background p-1.5 shadow-lift"
        >
          <DropdownMenu.Label className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('theme.label')}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={preference}
            onValueChange={(v) => setPreference(v as ThemePreference)}
          >
            {OPTIONS.map((o) => (
              <DropdownMenu.RadioItem
                key={o.value}
                value={o.value}
                className="flex cursor-pointer items-center gap-2.5 rounded px-2.5 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-mint"
              >
                <FontAwesomeIcon icon={o.icon} className="w-4 text-muted-foreground" aria-hidden />
                <span className="flex-1">{t(o.labelKey)}</span>
                <DropdownMenu.ItemIndicator>
                  <FontAwesomeIcon icon={faCheck} className="text-xs text-primary" aria-hidden />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
