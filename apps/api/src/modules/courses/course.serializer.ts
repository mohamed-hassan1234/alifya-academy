import type { Types } from 'mongoose';
import {
  deriveCourseDisplayStatus,
  type AdminCourseDto,
  type CategoryDto,
  type PublicCourseDto,
} from '@alifya/shared';
import type { CourseAttrs } from './course.model.js';

export type PopulatedCourse = Omit<CourseAttrs, 'category' | 'instructors'> & {
  _id: Types.ObjectId;
  category: { _id: Types.ObjectId; name: string; slug: string } | null;
  instructors: { _id: Types.ObjectId; fullName: string; avatarUrl?: string | null }[];
  createdAt: Date;
  updatedAt: Date;
};

export const COURSE_POPULATE = [
  { path: 'category', select: 'name slug' },
  { path: 'instructors', select: 'fullName avatarUrl' },
];

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toPublicCourse(c: PopulatedCourse, now = new Date()): PublicCourseDto {
  const displayStatus = deriveCourseDisplayStatus(
    {
      publicationStatus: c.publicationStatus,
      registrationMode: c.registrationMode,
      registrationOpensAt: c.registrationOpensAt,
      registrationClosesAt: c.registrationClosesAt,
      startDate: c.startDate,
      endDate: c.endDate,
      lifecycleOverride: c.lifecycleOverride ?? null,
      capacity: c.capacity,
      seatsTaken: c.enrolledCount,
    },
    now,
  );
  return {
    id: String(c._id),
    title: c.title,
    slug: c.slug,
    subtitle: c.subtitle ?? '',
    description: c.description ?? '',
    thumbnailUrl: c.thumbnailUrl ?? null,
    category: c.category ? { name: c.category.name, slug: c.category.slug } : null,
    instructors: c.instructors.map((i) => ({
      id: String(i._id),
      fullName: i.fullName,
      avatarUrl: i.avatarUrl ?? null,
    })),
    feeAmount: c.feeAmount,
    currency: c.currency as PublicCourseDto['currency'],
    isFree: c.feeAmount === 0,
    durationText: c.durationText ?? '',
    startDate: iso(c.startDate),
    endDate: iso(c.endDate),
    schedule: c.schedule.map((s) => ({ day: s.day, startTime: s.startTime, endTime: s.endTime })),
    timezone: c.timezone ?? 'Africa/Mogadishu',
    level: c.level as PublicCourseDto['level'],
    language: c.language as PublicCourseDto['language'],
    learningObjectives: c.learningObjectives,
    entryRequirements: c.entryRequirements,
    capacity: c.capacity ?? null,
    seatsRemaining: c.capacity != null ? Math.max(0, c.capacity - c.enrolledCount) : null,
    registrationOpensAt: iso(c.registrationOpensAt),
    registrationClosesAt: iso(c.registrationClosesAt),
    displayStatus,
    registrationOpen: displayStatus === 'registration_open',
    featured: c.featured,
  };
}

export function toAdminCourse(c: PopulatedCourse): AdminCourseDto {
  return {
    ...toPublicCourse(c),
    categoryId: c.category ? String(c.category._id) : null,
    instructorIds: c.instructors.map((i) => String(i._id)),
    publicationStatus: c.publicationStatus,
    registrationMode: c.registrationMode,
    lifecycleOverride: c.lifecycleOverride ?? null,
    publishedAt: iso(c.publishedAt),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toCategoryDto(c: {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string | null;
  order?: number | null;
  isActive?: boolean | null;
}): CategoryDto {
  return {
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    description: c.description ?? '',
    order: c.order ?? 0,
    isActive: c.isActive ?? true,
  };
}
