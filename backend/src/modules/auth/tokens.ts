import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';

const ISSUER = 'alifya-api';
const AUDIENCE = 'alifya-web';

export interface AccessClaims {
  sub: string;
  /** Session family id — lets logout/revocation invalidate outstanding access tokens. */
  sid: string;
  iat: number;
  exp: number;
}

export function signAccessToken(userId: string, sessionFamily: string): string {
  return jwt.sign({ sid: sessionFamily }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    const claims = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof claims === 'string' || !claims.sub || typeof claims.sid !== 'string' || !claims.iat) {
      throw new Error('Malformed token');
    }
    return claims as AccessClaims;
  } catch {
    throw ApiError.unauthenticated('Invalid or expired access token');
  }
}
