import type { AxiosError } from 'axios';
import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, ApiSuccess, AuthSession, MediaAssetDto, PaginationMeta } from '@alifya/shared';

/**
 * Access tokens live ONLY in memory (never localStorage). The refresh token is an HttpOnly cookie the
 * SPA cannot read; a session is restored on load via POST /auth/refresh with the CSRF double-submit header.
 */
let accessToken: string | null = null;
let onSessionChange: ((s: AuthSession | null) => void) | null = null;

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const registerSessionListener = (fn: (s: AuthSession | null) => void) => {
  onSessionChange = fn;
};

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export const http = axios.create({ baseURL: '/api/v1', withCredentials: true, timeout: 20_000 });

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  const csrf = readCookie('alf_csrf');
  if (csrf) config.headers.set('X-CSRF-Token', csrf);
  return config;
});

/** De-duplicates concurrent refreshes so parallel 401s trigger one rotation. */
let refreshing: Promise<AuthSession | null> | null = null;

export function refreshSession(): Promise<AuthSession | null> {
  // The CSRF cookie is issued together with the refresh cookie: without it there is no session to restore.
  if (!readCookie('alf_csrf')) {
    setAccessToken(null);
    onSessionChange?.(null);
    return Promise.resolve(null);
  }
  refreshing ??= http
    .post<ApiSuccess<AuthSession | null>>('/auth/refresh', null, {
      _skipAuthRetry: true,
    } as AxiosRequestConfig)
    .then((r) => r.data.data)
    .catch(() => null)
    .then((session) => {
      setAccessToken(session?.accessToken ?? null);
      onSessionChange?.(session);
      return session;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean; _skipAuthRetry?: boolean };

http.interceptors.response.use(undefined, async (error: AxiosError<ApiErrorBody>) => {
  const cfg = error.config as RetryConfig | undefined;
  const isAuthCall = cfg?.url?.startsWith('/auth/');
  if (
    error.response?.status === 401 &&
    cfg &&
    !cfg._retried &&
    !cfg._skipAuthRetry &&
    !isAuthCall &&
    accessToken
  ) {
    cfg._retried = true;
    const session = await refreshSession();
    if (session) return http(cfg);
  }
  throw error;
});

/* ------------------------------ helpers ------------------------------ */

export interface Paged<T> {
  data: T;
  meta: PaginationMeta;
}

export async function apiGet<T>(url: string, params?: object): Promise<T> {
  return (await http.get<ApiSuccess<T>>(url, { params })).data.data;
}
export async function apiGetPaged<T>(url: string, params?: object): Promise<Paged<T>> {
  const r = (await http.get<ApiSuccess<T>>(url, { params })).data;
  return { data: r.data, meta: r.meta! };
}
export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return (await http.post<ApiSuccess<T>>(url, body)).data.data;
}
export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return (await http.patch<ApiSuccess<T>>(url, body)).data.data;
}
export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  return (await http.put<ApiSuccess<T>>(url, body)).data.data;
}
export async function apiDelete<T>(url: string): Promise<T> {
  return (await http.delete<ApiSuccess<T>>(url)).data.data;
}

export interface NormalizedError {
  status: number;
  code: string;
  message: string;
  fields: Record<string, string>;
}

export function normalizeError(err: unknown): NormalizedError {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    const body = err.response?.data;
    if (body?.error) {
      return {
        status: err.response!.status,
        code: body.error.code,
        message: body.error.message,
        fields: body.error.fields ?? {},
      };
    }
    if (!err.response)
      return {
        status: 0,
        code: 'NETWORK',
        message: 'Network error. Check your connection and try again.',
        fields: {},
      };
  }
  return { status: 500, code: 'UNKNOWN', message: 'Something went wrong. Please try again.', fields: {} };
}

/** Multipart upload with progress reporting. Validation is repeated (authoritatively) on the server. */
export async function apiUpload(
  file: File,
  purpose: string,
  onProgress?: (pct: number) => void,
): Promise<MediaAssetDto> {
  const form = new FormData();
  form.append('purpose', purpose);
  form.append('file', file);
  const res = await http.post<ApiSuccess<MediaAssetDto>>('/media', form, {
    timeout: 10 * 60_000,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data.data;
}

/** Short-lived link for a private file (video/PDF/resource), usable in <video src> or downloads. */
export async function apiMediaLink(mediaId: string): Promise<string> {
  return (await apiGet<{ url: string; expiresAt: string | null }>(`/media/${mediaId}/link`)).url;
}
