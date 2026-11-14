import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** URL-safe opaque random token. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/** One-way hash for storing tokens at rest (tokens are high-entropy, so a fast hash is appropriate). */
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
