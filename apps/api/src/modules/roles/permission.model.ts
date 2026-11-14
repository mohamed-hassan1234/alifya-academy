import { Schema, model } from 'mongoose';

/** Mirror of PERMISSION_CATALOGUE (shared). Synced by the RBAC seeder; read-only through the API. */
const permissionSchema = new Schema(
  {
    key: { type: String, required: true },
    group: { type: String, required: true },
    description: { type: String, required: true },
  },
  { timestamps: true },
);
permissionSchema.index({ key: 1 }, { unique: true });

export const PermissionModel = model('Permission', permissionSchema);
