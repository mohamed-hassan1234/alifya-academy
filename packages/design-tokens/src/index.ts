/**
 * Official Alifya Academy brand palette (source of truth).
 * Components must consume these through CSS variables / Tailwind theme, never as ad-hoc hex values.
 */
export const brandColors = {
  primary: '#17332C', // Deep Green
  accent: '#DCA477', // Warm Peach
  background: '#FFFFFF', // Pure White
  ivory: '#FAF8F5', // Soft Ivory (secondary background)
  mint: '#EEF3F0', // Light Green (soft section background)
  text: '#17231F', // Dark Green-Black
  muted: '#64716B', // Muted Green-Gray
  border: '#E8ECE9', // Soft Neutral
  borderStrong: '#D8DFDA',
  surfaceHover: '#F6F7F5',
} as const;

/** Dark-theme surfaces (see tokens.css :root.dark), derived from the logo background #182D28. */
export const darkSurfaces = {
  background: '#0D1815',
  ivory: '#111F1B',
  mint: '#1A2C27',
  text: '#E4ECE8',
  primaryText: '#B2D6C4',
} as const;

export const fontFamilies = {
  /** Headings */
  display: [
    '"Plus Jakarta Sans"',
    'Inter',
    'system-ui',
    '-apple-system',
    '"Segoe UI"',
    'Arial',
    'sans-serif',
  ],
  /** Body copy and UI */
  sans: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
} as const;

export type BrandColor = keyof typeof brandColors;
