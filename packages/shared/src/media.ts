import type { Permission } from './permissions.js';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;
export const VIDEO_TYPES = ['video/mp4', 'video/webm'] as const;

export interface MediaPurposeRule {
  /** Allowed MIME types, verified by sniffing file content (extensions are never trusted). */
  types: readonly string[];
  maxBytes: number;
  visibility: 'public' | 'private';
  /** Caller needs ANY of these. Empty = any authenticated user. */
  anyPermission: readonly Permission[];
  /** Users holding this role may also upload (e.g. instructors uploading their own photo or lesson files). */
  roles?: readonly string[];
}

const MB = 1024 * 1024;

/**
 * Upload purposes. SVG is deliberately excluded everywhere (it can carry scripts).
 * Public assets are cacheable by anyone; private assets require authorization or a short-lived signed link.
 */
export const MEDIA_PURPOSES = {
  avatar: { types: IMAGE_TYPES, maxBytes: 2 * MB, visibility: 'public', anyPermission: [] },
  course_thumbnail: {
    types: IMAGE_TYPES,
    maxBytes: 5 * MB,
    visibility: 'public',
    anyPermission: ['courses.create', 'courses.update'],
  },
  program_image: {
    types: IMAGE_TYPES,
    maxBytes: 5 * MB,
    visibility: 'public',
    anyPermission: ['programs.manage'],
  },
  instructor_photo: {
    types: IMAGE_TYPES,
    maxBytes: 3 * MB,
    visibility: 'public',
    anyPermission: ['instructors.manage'],
    roles: ['instructor'],
  },
  speaker_photo: {
    types: IMAGE_TYPES,
    maxBytes: 3 * MB,
    visibility: 'public',
    anyPermission: ['webinar_speakers.manage', 'webinars.create'],
  },
  webinar_image: {
    types: IMAGE_TYPES,
    maxBytes: 8 * MB,
    visibility: 'public',
    anyPermission: ['webinars.create', 'webinars.update'],
  },
  event_banner: {
    types: IMAGE_TYPES,
    maxBytes: 8 * MB,
    visibility: 'public',
    anyPermission: ['events.manage'],
  },
  news_image: {
    types: IMAGE_TYPES,
    maxBytes: 8 * MB,
    visibility: 'public',
    anyPermission: ['news.manage', 'cms.manage'],
  },
  site_asset: {
    types: IMAGE_TYPES,
    maxBytes: 8 * MB,
    visibility: 'public',
    anyPermission: ['settings.manage'],
  },
  lesson_resource: {
    types: [...DOCUMENT_TYPES, ...VIDEO_TYPES, ...IMAGE_TYPES],
    maxBytes: 200 * MB,
    visibility: 'private',
    anyPermission: ['lessons.create', 'lessons.update'],
  },
} as const satisfies Record<string, MediaPurposeRule>;

export type MediaPurpose = keyof typeof MEDIA_PURPOSES;
export const MEDIA_PURPOSE_KEYS = Object.keys(MEDIA_PURPOSES) as MediaPurpose[];

export interface MediaAssetDto {
  id: string;
  purpose: MediaPurpose;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: 'public' | 'private';
  /** Stable URL. Public assets can be used directly in <img>; private ones need a signed link. */
  url: string;
  createdAt: string;
}

export const mediaContentPath = (id: string) => `/api/v1/media/${id}/content`;
