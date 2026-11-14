import type { CourseDisplayStatus, LifecycleOverride, PublicationStatus, RegistrationMode } from './enums.js';

export interface CourseStatusInput {
  publicationStatus: PublicationStatus;
  registrationMode: RegistrationMode;
  registrationOpensAt?: Date | string | null;
  registrationClosesAt?: Date | string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  lifecycleOverride?: LifecycleOverride | null;
  capacity?: number | null;
  seatsTaken?: number;
}

const toTime = (v: Date | string | null | undefined): number | null =>
  v === null || v === undefined ? null : new Date(v).getTime();

/**
 * Derives the user-facing course status. Precedence (highest first):
 *   1. archived           — publication archived
 *   2. draft              — not published
 *   3. completed          — manual override, or endDate has passed
 *   4. in_progress        — manual override, or startDate has passed
 *   5. registration_open  — mode open AND inside the (optional) window AND seats remain
 *   6. registration_closed
 */
export function deriveCourseDisplayStatus(c: CourseStatusInput, now: Date = new Date()): CourseDisplayStatus {
  const t = now.getTime();
  if (c.publicationStatus === 'archived') return 'archived';
  if (c.publicationStatus === 'draft') return 'draft';

  const end = toTime(c.endDate);
  const start = toTime(c.startDate);
  if (c.lifecycleOverride === 'completed' || (end !== null && end <= t)) return 'completed';
  if (c.lifecycleOverride === 'in_progress' || (start !== null && start <= t)) return 'in_progress';

  return isRegistrationOpen(c, now) ? 'registration_open' : 'registration_closed';
}

export function isRegistrationOpen(c: CourseStatusInput, now: Date = new Date()): boolean {
  const t = now.getTime();
  if (c.publicationStatus !== 'published' || c.registrationMode !== 'open') return false;
  if (c.lifecycleOverride) return false;
  const opens = toTime(c.registrationOpensAt);
  const closes = toTime(c.registrationClosesAt);
  if (opens !== null && t < opens) return false;
  if (closes !== null && t >= closes) return false;
  if (c.capacity != null && (c.seatsTaken ?? 0) >= c.capacity) return false;
  return true;
}
