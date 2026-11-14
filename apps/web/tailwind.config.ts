import type { Config } from 'tailwindcss';
import { fontFamilies } from '../../packages/design-tokens/src/index';

const token = (name: string) => `rgb(var(--alf-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: token('primary'),
          hover: token('primary-hover'),
          foreground: token('background'),
        },
        accent: { DEFAULT: token('accent'), strong: token('accent-strong'), foreground: token('primary') },
        background: token('background'),
        ivory: token('ivory'),
        mint: token('mint'),
        foreground: token('text'),
        muted: { DEFAULT: token('mint'), foreground: token('muted') },
        border: token('border'),
        input: token('border'),
        ring: token('primary'),
        danger: token('danger'),
        success: token('success'),
        warning: token('warning'),
        info: token('info'),
      },
      fontFamily: { display: [...fontFamilies.display], sans: [...fontFamilies.sans] },
      borderRadius: {
        lg: 'var(--alf-radius)',
        md: 'calc(var(--alf-radius) - 2px)',
        sm: 'calc(var(--alf-radius) - 4px)',
      },
      boxShadow: { card: '0 1px 2px rgb(23 51 44 / 0.04), 0 4px 16px rgb(23 51 44 / 0.06)' },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
} satisfies Config;
