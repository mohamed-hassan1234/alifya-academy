import type { ApplicationStatus, EnrollmentStatus } from './enums.js';
import type { WebinarDisplayStatus, WebinarPlatform } from './validation/academic.js';
import type {
  CourseDisplayStatus,
  CourseLevel,
  Currency,
  LifecycleOverride,
  PublicationStatus,
  RegistrationMode,
  SupportedLanguage,
  UserStatus,
  Weekday,
} from './enums.js';
import type { Permission } from './permissions.js';

/* ---------- Envelope ---------- */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'ACCOUNT_NOT_VERIFIED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_INACTIVE'
  | 'CSRF_FAILED'
  | 'FEATURE_DISABLED'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field-level errors, keyed by dotted path. */
    fields?: Record<string, string>;
    requestId?: string;
  };
}

/* ---------- Users ---------- */
export interface RoleSummary {
  id: string;
  key: string;
  name: string;
}

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  preferredLanguage: SupportedLanguage;
  emailVerifiedAt: string | null;
  roles: RoleSummary[];
  permissions: Permission[];
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: CurrentUser;
}

export interface AdminUserRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  roles: RoleSummary[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface RoleDetail {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  userCount: number;
}

export interface PermissionInfo {
  key: Permission;
  group: string;
  description: string;
}

export interface AuditLogEntry {
  id: string;
  actor: { id: string; fullName: string; email: string } | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  outcome: 'success' | 'failure';
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

/* ---------- Courses ---------- */
export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  order: number;
  isActive: boolean;
}

export interface CourseInstructorDto {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface ScheduleSlot {
  day: Weekday;
  startTime: string;
  endTime: string;
}

export interface PublicCourseDto {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  thumbnailUrl: string | null;
  category: { name: string; slug: string } | null;
  instructors: CourseInstructorDto[];
  feeAmount: number;
  currency: Currency;
  isFree: boolean;
  durationText: string;
  startDate: string | null;
  endDate: string | null;
  schedule: ScheduleSlot[];
  timezone: string;
  level: CourseLevel;
  language: SupportedLanguage;
  learningObjectives: string[];
  entryRequirements: string[];
  capacity: number | null;
  seatsRemaining: number | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  displayStatus: CourseDisplayStatus;
  registrationOpen: boolean;
  featured: boolean;
}

export interface AdminCourseDto extends PublicCourseDto {
  categoryId: string | null;
  instructorIds: string[];
  publicationStatus: PublicationStatus;
  registrationMode: RegistrationMode;
  lifecycleOverride: LifecycleOverride | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Settings ---------- */
export interface PublicSiteSettings {
  academyName: string;
  tagline: string;
  logoUrl: string | null;
  contact: { email: string | null; phones: string[]; address: string | null };
  social: Partial<Record<'facebook' | 'instagram' | 'linkedin' | 'x' | 'youtube' | 'tiktok', string | null>>;
  hero: { title: string | null; subtitle: string | null; imageUrl: string | null };
  about: {
    /** Photograph shown on the About page. */
    imageUrl: string | null;
    summary: string | null;
    introduction: string | null;
    mission: string | null;
    vision: string | null;
    approach: string | null;
    values: string[];
    objectives: string[];
  };
  defaultTimezone: string;
  defaultCurrency: Currency;
  supportedLanguages: SupportedLanguage[];
}

/* ---------- Programs ---------- */
export interface ProgramCourseDto {
  id: string;
  title: string;
  slug: string;
  level: CourseLevel;
  durationText: string;
  isFree: boolean;
  feeAmount: number;
  currency: Currency;
  thumbnailUrl: string | null;
}

export interface PublicProgramDto {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  imageUrl: string | null;
  durationText: string;
  objectives: string[];
  entryRequirements: string[];
  /** Only PUBLISHED courses are included publicly. */
  courses: ProgramCourseDto[];
  coordinator: { id: string; fullName: string } | null;
}

export interface AdminProgramDto extends PublicProgramDto {
  courseIds: string[];
  coordinatorId: string | null;
  publicationStatus: PublicationStatus;
  displayOrder: number;
  publishedAt: string | null;
  updatedAt: string;
}

/* ---------- Learning paths (roadmaps) ---------- */
export interface LearningPathStageDto {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  durationText: string;
  /** Publicly: PUBLISHED courses only. */
  courses: ProgramCourseDto[];
}

export interface PublicLearningPathSummaryDto {
  id: string;
  title: string;
  slug: string;
  summary: string;
  durationText: string;
  stageCount: number;
  courseCount: number;
}

export interface PublicLearningPathDto extends PublicLearningPathSummaryDto {
  description: string;
  outcomes: string[];
  stages: LearningPathStageDto[];
}

export interface AdminLearningPathStageDto extends LearningPathStageDto {
  courseIds: string[];
}

export interface AdminLearningPathDto extends Omit<PublicLearningPathDto, 'stages'> {
  stages: AdminLearningPathStageDto[];
  publicationStatus: PublicationStatus;
  displayOrder: number;
  publishedAt: string | null;
  updatedAt: string;
}

/* ---------- Course applications & enrolments ---------- */
export interface ApplicationCourseDto {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  isFree: boolean;
  feeAmount: number;
  currency: Currency;
}

export interface MyApplicationDto {
  id: string;
  status: ApplicationStatus;
  motivation: string;
  submittedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface MyEnrollmentDto {
  id: string;
  status: EnrollmentStatus;
  enrolledAt: string;
}

/** Signed-in user's relationship with one course. */
export interface MyCourseStatusDto {
  application: MyApplicationDto | null;
  enrollment: MyEnrollmentDto | null;
  canApply: boolean;
}

export interface MyLearningDto {
  applications: (MyApplicationDto & { course: ApplicationCourseDto })[];
  enrollments: (MyEnrollmentDto & { course: ApplicationCourseDto })[];
}

export interface AdminApplicationDto extends MyApplicationDto {
  course: ApplicationCourseDto;
  student: { id: string; fullName: string; email: string };
  decidedBy: { id: string; fullName: string } | null;
}

/* ---------- Webinars ---------- */
export interface WebinarSpeakerDto {
  name: string;
  title: string;
  organization: string;
  bio: string;
  photoUrl: string | null;
}

export interface PublicWebinarSummaryDto {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  summary: string;
  topic: string;
  posterUrl: string | null;
  speakers: WebinarSpeakerDto[];
  startsAt: string;
  endsAt: string;
  timezone: string;
  platform: WebinarPlatform;
  venue: string;
  status: WebinarDisplayStatus;
  capacity: number | null;
  seatsLeft: number | null;
  featured: boolean;
}

export interface PublicWebinarDto extends PublicWebinarSummaryDto {
  description: string;
  agenda: string[];
  cancelReason: string | null;
  related: PublicWebinarSummaryDto[];
}

/** The signed-in user's registration. Join details appear only while joining is allowed. */
export interface MyWebinarRegistrationDto {
  registered: boolean;
  registeredAt: string | null;
  canJoinNow: boolean;
  joinOpensAt: string;
  meetingUrl: string | null;
  meetingPasscode: string | null;
  recordingUrl: string | null;
}

export interface AdminWebinarDto extends Omit<PublicWebinarDto, 'related'> {
  publicationStatus: PublicationStatus;
  registrationOpen: boolean;
  registeredCount: number;
  meetingUrl: string | null;
  meetingPasscode: string | null;
  joinOpensMinutesBefore: number;
  recordingUrl: string | null;
  cancelledAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface WebinarRegistrationDto {
  id: string;
  user: { id: string; fullName: string; email: string };
  status: 'registered' | 'cancelled';
  registeredAt: string;
  cancelledAt: string | null;
  attendedAt: string | null;
}

/* ---------- Instructors ---------- */
export interface InstructorSocial {
  linkedin?: string | null;
  x?: string | null;
  website?: string | null;
  facebook?: string | null;
}

export interface PublicInstructorDto {
  id: string; // user id
  fullName: string;
  professionalTitle: string;
  specialization: string;
  biography: string;
  photoUrl: string | null;
  social: InstructorSocial;
}

export interface PublicInstructorDetailDto extends PublicInstructorDto {
  courses: ProgramCourseDto[];
}

export interface AdminInstructorDto extends PublicInstructorDto {
  email: string;
  status: UserStatus;
  isPublic: boolean;
  assignedCourses: { id: string; title: string; publicationStatus: PublicationStatus }[];
}

/* ---------- Curriculum ---------- */
export interface LessonResourceDto {
  mediaId: string;
  title: string;
}

export interface ManagedLessonDto {
  id: string;
  sectionId: string;
  title: string;
  type: 'text' | 'video' | 'pdf';
  summary: string;
  content: string;
  videoMediaId: string | null;
  videoUrl: string | null;
  pdfMediaId: string | null;
  resources: LessonResourceDto[];
  durationMinutes: number | null;
  isPreview: boolean;
  publicationStatus: 'draft' | 'published';
  order: number;
  updatedAt: string;
}

export interface ManagedSectionDto {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: ManagedLessonDto[];
}

export interface ManagedCurriculumDto {
  course: { id: string; title: string; slug: string; publicationStatus: PublicationStatus };
  sections: ManagedSectionDto[];
  /** What the caller may do — mirrors server-side checks so the UI hides unusable actions. */
  can: { edit: boolean; publish: boolean };
}

/** Public outline: titles only, never lesson bodies or private files. */
export interface CurriculumOutlineDto {
  sections: {
    id: string;
    title: string;
    lessons: {
      id: string;
      title: string;
      type: 'text' | 'video' | 'pdf';
      durationMinutes: number | null;
      isPreview: boolean;
    }[];
  }[];
  totalLessons: number;
  totalMinutes: number;
}

export interface LessonPreviewDto {
  id: string;
  title: string;
  type: 'text' | 'video' | 'pdf';
  summary: string;
  content: string;
  /** Short-lived link for uploaded media, or the external https video link. */
  mediaUrl: string | null;
  durationMinutes: number | null;
}

export interface InstructorCourseDto {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  publicationStatus: PublicationStatus;
  displayStatus: CourseDisplayStatus;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
  schedule: ScheduleSlot[];
  lessonCount: number;
  publishedLessonCount: number;
}

export interface ContactMessageDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  createdAt: string;
}
