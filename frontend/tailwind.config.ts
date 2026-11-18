import type { Config } from 'tailwindcss';
import { fontFamilies } from '../packages/design-tokens/src/index';

const token = (name: string) => `rgb(var(--alf-${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
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
        brand: { DEFAULT: token('brand'), hover: token('brand-hover'), foreground: token('on-brand') },
        accent: { DEFAULT: token('accent'), strong: token('accent-strong'), foreground: token('primary') },
        background: token('background'),
        ivory: token('ivory'),
        mint: token('mint'),
        foreground: token('text'),
        muted: { DEFAULT: token('mint'), foreground: token('muted') },
        border: { DEFAULT: token('border'), strong: token('border-strong') },
        'surface-hover': token('surface-hover'),
        input: token('border'),
        ring: token('primary'),
        danger: token('danger'),
        success: token('success'),
        warning: token('warning'),
        info: token('info'),
      },
      fontFamily: { display: [...fontFamilies.display], sans: [...fontFamilies.sans] },
      borderRadius: {
        xl: '1.5rem',
        lg: 'var(--alf-radius)',
        md: 'calc(var(--alf-radius) - 2px)',
        sm: 'calc(var(--alf-radius) - 4px)',
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--alf-shadow) / 0.04), 0 4px 16px rgb(var(--alf-shadow) / 0.06)',
        lift: '0 2px 6px rgb(var(--alf-shadow) / 0.06), 0 24px 48px -12px rgb(var(--alf-shadow) / 0.22)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
} satisfies Config;
