/** Escape user input before using it inside a RegExp (prevents regex injection / ReDoS). */
export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
