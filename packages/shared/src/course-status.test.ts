import { describe, expect, it } from 'vitest';
import { deriveCourseDisplayStatus, isRegistrationOpen, type CourseStatusInput } from './course-status.js';

const now = new Date('2026-06-01T10:00:00Z');
const base: CourseStatusInput = { publicationStatus: 'published', registrationMode: 'open' };

describe('deriveCourseDisplayStatus', () => {
  it('archived and draft take precedence over everything', () => {
    expect(
      deriveCourseDisplayStatus(
        { ...base, publicationStatus: 'archived', lifecycleOverride: 'completed' },
        now,
      ),
    ).toBe('archived');
    expect(
      deriveCourseDisplayStatus({ ...base, publicationStatus: 'draft', startDate: '2020-01-01' }, now),
    ).toBe('draft');
  });
  it('completed when end date passed, even if registration open', () => {
    expect(deriveCourseDisplayStatus({ ...base, startDate: '2026-01-01', endDate: '2026-05-01' }, now)).toBe(
      'completed',
    );
  });
  it('in_progress when started', () => {
    expect(deriveCourseDisplayStatus({ ...base, startDate: '2026-05-01', endDate: '2026-09-01' }, now)).toBe(
      'in_progress',
    );
  });
  it('manual overrides win over dates', () => {
    expect(
      deriveCourseDisplayStatus({ ...base, startDate: '2027-01-01', lifecycleOverride: 'in_progress' }, now),
    ).toBe('in_progress');
    expect(deriveCourseDisplayStatus({ ...base, lifecycleOverride: 'completed' }, now)).toBe('completed');
  });
  it('registration open / closed', () => {
    expect(deriveCourseDisplayStatus({ ...base, startDate: '2026-07-01' }, now)).toBe('registration_open');
    expect(deriveCourseDisplayStatus({ ...base, registrationMode: 'closed' }, now)).toBe(
      'registration_closed',
    );
  });
});

describe('isRegistrationOpen', () => {
  it('respects the registration window', () => {
    expect(isRegistrationOpen({ ...base, registrationOpensAt: '2026-06-02' }, now)).toBe(false);
    expect(isRegistrationOpen({ ...base, registrationClosesAt: '2026-06-01T10:00:00Z' }, now)).toBe(false);
    expect(
      isRegistrationOpen(
        { ...base, registrationOpensAt: '2026-05-01', registrationClosesAt: '2026-07-01' },
        now,
      ),
    ).toBe(true);
  });
  it('closes when capacity is reached', () => {
    expect(isRegistrationOpen({ ...base, capacity: 10, seatsTaken: 10 }, now)).toBe(false);
    expect(isRegistrationOpen({ ...base, capacity: 10, seatsTaken: 9 }, now)).toBe(true);
  });
});
