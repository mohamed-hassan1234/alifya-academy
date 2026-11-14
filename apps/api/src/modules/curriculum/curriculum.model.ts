import { Schema, model, type InferSchemaType } from 'mongoose';

const courseSectionSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 1000 },
    order: { type: Number, required: true, min: 0 },
    /** Soft delete: lessons may later carry learner progress that must be preserved. */
    deletedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
courseSectionSchema.index({ course: 1, deletedAt: 1, order: 1 });
export const CourseSection = model('CourseSection', courseSectionSchema);

const lessonSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    section: { type: Schema.Types.ObjectId, ref: 'CourseSection', required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: ['text', 'video', 'pdf'], required: true },
    summary: { type: String, default: '', maxlength: 500 },
    content: { type: String, default: '', maxlength: 50000 },
    videoMedia: { type: Schema.Types.ObjectId, ref: 'MediaAsset', default: null },
    videoUrl: { type: String, default: null },
    pdfMedia: { type: Schema.Types.ObjectId, ref: 'MediaAsset', default: null },
    resources: {
      type: [
        {
          _id: false,
          media: { type: Schema.Types.ObjectId, ref: 'MediaAsset', required: true },
          title: { type: String, required: true, maxlength: 160 },
        },
      ],
      default: [],
    },
    durationMinutes: { type: Number, default: null, min: 0 },
    /** Preview lessons are visible to visitors on the public course page. */
    isPreview: { type: Boolean, default: false },
    publicationStatus: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date, default: null },
    order: { type: Number, required: true, min: 0 },
    deletedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
lessonSchema.index({ course: 1, deletedAt: 1, section: 1, order: 1 });
lessonSchema.index({ 'resources.media': 1 });
lessonSchema.index({ videoMedia: 1 });
lessonSchema.index({ pdfMedia: 1 });

export type LessonAttrs = InferSchemaType<typeof lessonSchema>;
export const Lesson = model('Lesson', lessonSchema);
