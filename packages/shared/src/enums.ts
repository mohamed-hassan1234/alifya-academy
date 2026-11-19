export const USER_STATUSES = ['pending_verification', 'active', 'suspended', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced', 'all_levels'] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

/** Publication state — controls public visibility. */
export const PUBLICATION_STATUSES = ['draft', 'published', 'archived'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

/** Registration state — whether new applications are accepted (dates may further restrict). */
export const REGISTRATION_MODES = ['open', 'closed'] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

/** Optional manual lifecycle override; otherwise lifecycle is derived from start/end dates. */
export const LIFECYCLE_OVERRIDES = ['in_progress', 'completed'] as const;
export type LifecycleOverride = (typeof LIFECYCLE_OVERRIDES)[number];

/** Display status shown to users — always DERIVED, never stored. */
export const COURSE_DISPLAY_STATUSES = [
  'draft',
  'archived',
  'completed',
  'in_progress',
  'registration_open',
  'registration_closed',
] as const;
export type CourseDisplayStatus = (typeof COURSE_DISPLAY_STATUSES)[number];

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const SUPPORTED_CURRENCIES = ['USD', 'SOS'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const SUPPORTED_LANGUAGES = ['en', 'so'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_TIMEZONE = 'Africa/Mogadishu';

/** Course application lifecycle (admissions). Payment status is tracked separately on the enrolment. */
export const APPLICATION_STATUSES = ['submitted', 'approved', 'rejected', 'withdrawn'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** active = has access; pending_payment = admitted to a paid course, no access until payment is verified. */
export const ENROLLMENT_STATUSES = ['active', 'pending_payment', 'cancelled'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];
