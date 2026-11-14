/**
 * Permission catalogue — the single source of truth for every permission key.
 * The API seeds these into the `permissions` collection and validates role definitions against them.
 * Permissions are ALWAYS enforced on the backend; the frontend only uses them to shape navigation.
 */
export const PERMISSION_CATALOGUE = {
  // Users & access
  'users.read': { group: 'Users', description: 'View user accounts' },
  'users.create': { group: 'Users', description: 'Create user accounts' },
  'users.update': { group: 'Users', description: 'Edit user accounts' },
  'users.suspend': { group: 'Users', description: 'Suspend, disable or reactivate accounts' },
  'roles.manage': { group: 'Access control', description: 'Assign roles to users' },
  'permissions.manage': { group: 'Access control', description: 'Create roles and edit their permissions' },
  // Academic
  'courses.create': { group: 'Courses', description: 'Create courses' },
  'courses.read': { group: 'Courses', description: 'View all courses including drafts' },
  'courses.update': { group: 'Courses', description: 'Edit courses and categories' },
  'courses.publish': { group: 'Courses', description: 'Publish and unpublish courses' },
  'courses.archive': { group: 'Courses', description: 'Archive courses' },
  'programs.manage': { group: 'Courses', description: 'Manage academic programs' },
  'applications.review': { group: 'Admissions', description: 'Review applications' },
  'applications.approve': { group: 'Admissions', description: 'Approve or reject applications' },
  'enrollments.manage': { group: 'Admissions', description: 'Manage enrollments' },
  'lessons.manage': { group: 'Teaching', description: 'Manage lessons and materials' },
  'assignments.manage': { group: 'Teaching', description: 'Manage assignments' },
  'submissions.grade': { group: 'Teaching', description: 'Grade submissions' },
  'attendance.manage': { group: 'Teaching', description: 'Record attendance' },
  // Finance
  'payments.read': { group: 'Finance', description: 'View payment records' },
  'payments.verify': { group: 'Finance', description: 'Verify or reject manual payments' },
  'payments.refund': { group: 'Finance', description: 'Process refunds' },
  // Webinars & events
  'webinars.create': { group: 'Webinars', description: 'Create webinars and speakers' },
  'webinars.update': { group: 'Webinars', description: 'Edit webinars and speakers' },
  'webinars.publish': { group: 'Webinars', description: 'Publish and unpublish webinars' },
  'webinars.cancel': { group: 'Webinars', description: 'Cancel webinars' },
  'webinar_registrations.manage': { group: 'Webinars', description: 'Manage webinar registrations' },
  'events.manage': { group: 'Events', description: 'Manage events' },
  // Certificates
  'certificates.approve': { group: 'Certificates', description: 'Approve certificate eligibility' },
  'certificates.issue': { group: 'Certificates', description: 'Issue certificates' },
  'certificates.revoke': { group: 'Certificates', description: 'Revoke certificates' },
  // Content
  'cms.manage': { group: 'Content', description: 'Manage website content and news' },
  'cms.publish': { group: 'Content', description: 'Publish website content and news' },
  'announcements.manage': { group: 'Content', description: 'Send announcements' },
  // Reporting & system
  'reports.academic': { group: 'Reports', description: 'View academic reports' },
  'reports.financial': { group: 'Reports', description: 'View financial reports' },
  'settings.manage': { group: 'System', description: 'Manage system settings and feature flags' },
  'audit_logs.read': { group: 'System', description: 'Read audit logs' },
  // ---- v3 matrix additions (existing keys above are kept for backward compatibility) ----
  'students.read': { group: 'Users', description: 'View student records' },
  'students.manage': { group: 'Users', description: 'Manage student records' },
  'instructors.read': { group: 'Users', description: 'View instructor records' },
  'instructors.manage': { group: 'Users', description: 'Manage instructor profiles and photos' },
  'categories.manage': { group: 'Courses', description: 'Manage course categories' },
  'applications.read': { group: 'Admissions', description: 'View applications' },
  'applications.reject': { group: 'Admissions', description: 'Reject applications' },
  'lessons.create': { group: 'Teaching', description: 'Create lessons and curriculum sections' },
  'lessons.update': { group: 'Teaching', description: 'Edit lessons and curriculum sections' },
  'lessons.publish': { group: 'Teaching', description: 'Publish lessons to students' },
  'assignments.create': { group: 'Teaching', description: 'Create assignments' },
  'assignments.grade': { group: 'Teaching', description: 'Grade assignment submissions' },
  'payments.report': { group: 'Finance', description: 'View and export payment reports' },
  'webinar_speakers.manage': { group: 'Webinars', description: 'Manage webinar speakers and photos' },
  'news.manage': { group: 'Content', description: 'Manage news and blog posts' },
  'notifications.manage': { group: 'Content', description: 'Manage notifications and templates' },
} as const satisfies Record<string, { group: string; description: string }>;

export type Permission = keyof typeof PERMISSION_CATALOGUE;
export const ALL_PERMISSIONS = Object.keys(PERMISSION_CATALOGUE) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSION_CATALOGUE, value);
}

export const SYSTEM_ROLE_KEYS = [
  'student',
  'instructor',
  'admissions_officer',
  'finance_officer',
  'content_manager',
  'academy_admin',
  'super_admin',
] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

interface SystemRoleDefinition {
  name: string;
  description: string;
  permissions: readonly Permission[];
}

/**
 * Default permission sets. Students/instructors act mostly through ownership-scoped endpoints
 * (their own enrollments, their assigned courses) which do not need catalogue permissions.
 */
export const SYSTEM_ROLES: Record<SystemRoleKey, SystemRoleDefinition> = {
  student: {
    name: 'Student',
    description: 'Registered learner. Access is scoped to own records and enrolled courses.',
    permissions: [],
  },
  instructor: {
    name: 'Instructor',
    description: 'Teaches explicitly assigned courses only.',
    permissions: [
      'lessons.manage',
      'lessons.create',
      'lessons.update',
      'lessons.publish',
      'assignments.manage',
      'assignments.create',
      'assignments.grade',
      'submissions.grade',
      'attendance.manage',
    ],
  },
  admissions_officer: {
    name: 'Admissions Officer',
    description: 'Reviews applications and manages enrollments. No financial verification.',
    permissions: [
      'applications.read',
      'applications.review',
      'applications.approve',
      'applications.reject',
      'enrollments.manage',
      'courses.read',
      'students.read',
      'reports.academic',
    ],
  },
  finance_officer: {
    name: 'Finance Officer',
    description: 'Verifies payments, manages refunds and financial reports.',
    permissions: [
      'payments.read',
      'payments.verify',
      'payments.refund',
      'payments.report',
      'reports.financial',
    ],
  },
  content_manager: {
    name: 'Content Manager',
    description: 'Prepares public website content. Publishing requires cms.publish.',
    permissions: ['cms.manage', 'news.manage', 'announcements.manage'],
  },
  academy_admin: {
    name: 'Academy Administrator',
    description: 'Runs academy operations. Finance and security operations need explicit extra permissions.',
    permissions: [
      'users.read',
      'users.create',
      'users.update',
      'users.suspend',
      'courses.create',
      'courses.read',
      'courses.update',
      'courses.publish',
      'courses.archive',
      'programs.manage',
      'applications.review',
      'applications.approve',
      'enrollments.manage',
      'lessons.manage',
      'assignments.manage',
      'attendance.manage',
      'webinars.create',
      'webinars.update',
      'webinars.publish',
      'webinars.cancel',
      'webinar_registrations.manage',
      'events.manage',
      'certificates.approve',
      'certificates.issue',
      'certificates.revoke',
      'cms.manage',
      'cms.publish',
      'announcements.manage',
      'reports.academic',
      'students.read',
      'students.manage',
      'instructors.read',
      'instructors.manage',
      'categories.manage',
      'applications.read',
      'applications.reject',
      'lessons.create',
      'lessons.update',
      'lessons.publish',
      'assignments.create',
      'assignments.grade',
      'webinar_speakers.manage',
      'news.manage',
      'notifications.manage',
    ],
  },
  super_admin: {
    name: 'Super Administrator',
    description: 'Full system control. Always holds every permission.',
    permissions: ALL_PERMISSIONS,
  },
};

/** Keys introduced by the v3 permission matrix; used by the role-seeding migration. */
export const V3_ADDED_PERMISSIONS: readonly Permission[] = [
  'students.read',
  'students.manage',
  'instructors.read',
  'instructors.manage',
  'categories.manage',
  'applications.read',
  'applications.reject',
  'lessons.create',
  'lessons.update',
  'lessons.publish',
  'assignments.create',
  'assignments.grade',
  'payments.report',
  'webinar_speakers.manage',
  'news.manage',
  'notifications.manage',
];
