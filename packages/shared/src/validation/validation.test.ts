import { describe, expect, it } from 'vitest';
import { registerSchema, passwordSchema } from './auth.js';
import { createCourseSchema, updateCourseSchema } from './courses.js';
import { createRoleSchema } from './admin.js';
import { slugify } from './common.js';

describe('auth validation', () => {
  it('enforces password policy', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('longenoughbutnodigits').success).toBe(false);
    expect(passwordSchema.safeParse('GoodPassword2026').success).toBe(true);
  });
  it('requires matching passwords and accepted terms', () => {
    const ok = {
      fullName: 'Amina Ali',
      email: 'AMINA@Example.com ',
      password: 'GoodPassword2026',
      confirmPassword: 'GoodPassword2026',
      acceptTerms: true,
    };
    const parsed = registerSchema.parse(ok);
    expect(parsed.email).toBe('amina@example.com');
    expect(registerSchema.safeParse({ ...ok, confirmPassword: 'x' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, acceptTerms: false }).success).toBe(false);
  });
});

describe('course validation', () => {
  it('rejects end date before start date', () => {
    const r = createCourseSchema.safeParse({
      title: 'Data Basics',
      startDate: '2026-05-02',
      endDate: '2026-05-01',
    });
    expect(r.success).toBe(false);
  });
  it('rejects invalid timezone and applies defaults', () => {
    expect(createCourseSchema.safeParse({ title: 'Data Basics', timezone: 'Mars/Base' }).success).toBe(false);
    const r = createCourseSchema.parse({ title: 'Data Basics' });
    expect(r.timezone).toBe('Africa/Mogadishu');
    expect(r.feeAmount).toBe(0);
  });
  it('partial update does not inject defaults', () => {
    const r = updateCourseSchema.parse({ title: 'Renamed' });
    expect(r).toEqual({ title: 'Renamed' });
  });
});

describe('role validation', () => {
  it('rejects unknown permissions', () => {
    expect(
      createRoleSchema.safeParse({ key: 'tutor', name: 'Tutor', permissions: ['hack.all'] }).success,
    ).toBe(false);
    expect(
      createRoleSchema.safeParse({ key: 'tutor', name: 'Tutor', permissions: ['lessons.manage'] }).success,
    ).toBe(true);
  });
});

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('  Introduction to Data Science! ')).toBe('introduction-to-data-science');
    expect(slugify('Café Été')).toBe('cafe-ete');
  });
});
