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
  text: '#202B27', // Dark Green-Black
  muted: '#68756F', // Muted Green-Gray
  border: '#E5EAE6', // Soft Neutral
} as const;

export const fontFamilies = {
  display: ['"DM Serif Display"', 'Georgia', '"Times New Roman"', 'serif'],
  sans: ['Manrope', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
} as const;

export type BrandColor = keyof typeof brandColors;
