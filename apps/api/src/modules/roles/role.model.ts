import { Schema, model, type InferSchemaType } from 'mongoose';
import { ALL_PERMISSIONS } from '@alifya/shared';

const roleSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 300 },
    permissions: { type: [{ type: String, enum: ALL_PERMISSIONS }], default: [] },
    /** System roles cannot be deleted; super_admin permissions are locked to the full catalogue. */
    isSystem: { type: Boolean, default: false },
    /**
     * System roles only: the default permissions already offered by the seeder. New catalogue defaults are
     * added exactly once; permissions an administrator removed afterwards are never re-added.
     * Absent on roles created before this field existed (treated as "pre-v3 defaults offered").
     */
    seededPermissions: { type: [String], default: undefined },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
roleSchema.index({ key: 1 }, { unique: true });

export type RoleAttrs = InferSchemaType<typeof roleSchema>;
export const Role = model('Role', roleSchema);
