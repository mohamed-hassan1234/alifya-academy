import { Schema, model, type InferSchemaType } from 'mongoose';
import {
  COURSE_LEVELS,
  DEFAULT_TIMEZONE,
  LIFECYCLE_OVERRIDES,
  PUBLICATION_STATUSES,
  REGISTRATION_MODES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
  WEEKDAYS,
} from '@alifya/shared';

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 140 },
    description: { type: String, default: '', maxlength: 500 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
categorySchema.index({ slug: 1 }, { unique: true });
export const Category = model('Category', categorySchema);

const scheduleSlotSchema = new Schema(
  {
    day: { type: String, enum: WEEKDAYS, required: true },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false },
);

/**
 * Course state is split into three independent dimensions (see shared/course-status.ts):
 *   publicationStatus  — visibility (draft / published / archived)
 *   registrationMode   — whether applications are accepted (+ optional window dates, capacity)
 *   lifecycle          — derived from start/end dates, with optional manual override
 */
const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 140 },
    subtitle: { type: String, default: '', maxlength: 240 },
    description: { type: String, default: '', maxlength: 20000 },
    thumbnailUrl: { type: String, default: null },
    category: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    instructors: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    /** Minor units (cents). 0 = free. Never trusted from the client at payment time. */
    feeAmount: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    currency: { type: String, enum: SUPPORTED_CURRENCIES, default: 'USD' },
    durationText: { type: String, default: '', maxlength: 80 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    schedule: { type: [scheduleSlotSchema], default: [] },
    timezone: { type: String, default: DEFAULT_TIMEZONE },
    level: { type: String, enum: COURSE_LEVELS, default: 'all_levels' },
    language: { type: String, enum: SUPPORTED_LANGUAGES, default: 'en' },
    learningObjectives: { type: [String], default: [] },
    entryRequirements: { type: [String], default: [] },
    capacity: { type: Number, default: null, min: 1 },
    /** Maintained transactionally by the enrollment module (Phase 7). */
    enrolledCount: { type: Number, default: 0, min: 0 },
    publicationStatus: { type: String, enum: PUBLICATION_STATUSES, default: 'draft', required: true },
    registrationMode: { type: String, enum: REGISTRATION_MODES, default: 'closed', required: true },
    registrationOpensAt: { type: Date, default: null },
    registrationClosesAt: { type: Date, default: null },
    lifecycleOverride: { type: String, enum: [...LIFECYCLE_OVERRIDES, null], default: null },
    featured: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

courseSchema.index({ slug: 1 }, { unique: true });
courseSchema.index({ publicationStatus: 1, featured: -1, publishedAt: -1 });
courseSchema.index({ publicationStatus: 1, category: 1, level: 1 });
courseSchema.index({ instructors: 1 });
courseSchema.pre('validate', function (next) {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    this.invalidate('endDate', 'End date must be after start date');
  }
  if (this.capacity != null && this.enrolledCount > this.capacity) {
    this.invalidate('capacity', 'Capacity cannot be lower than current enrollments');
  }
  next();
});

export type CourseAttrs = InferSchemaType<typeof courseSchema>;
export const Course = model('Course', courseSchema);
