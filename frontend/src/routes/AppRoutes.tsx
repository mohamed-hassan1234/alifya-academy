import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Skeleton } from '@/components/ui/feedback';
import { GuestOnlyRoute, PermissionGuard, ProtectedRoute } from '@/features/auth/guards';
import { HomePage } from '@/pages/public/HomePage';
import { NotFoundPage } from '@/pages/public/NotFoundPage';

// Route-level code splitting: public landing stays in the main bundle; everything else loads on demand.
const named = <T,>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((m) => ({ default: m[name] as unknown as React.ComponentType })));

const CoursesPage = named(() => import('@/pages/public/CoursesPage'), 'CoursesPage');
const CourseDetailPage = named(() => import('@/pages/public/CourseDetailPage'), 'CourseDetailPage');
const auth = () => import('@/pages/public/AuthPages');
const LoginPage = named(auth, 'LoginPage');
const RegisterPage = named(auth, 'RegisterPage');
const ForgotPasswordPage = named(auth, 'ForgotPasswordPage');
const ResetPasswordPage = named(auth, 'ResetPasswordPage');
const VerifyEmailPage = named(auth, 'VerifyEmailPage');
const info = () => import('@/pages/public/InfoPages');
const AboutPage = named(info, 'AboutPage');
const ProgramsPage = named(info, 'ProgramsPage');
const ProgramDetailPage = named(info, 'ProgramDetailPage');
const InstructorsPage = named(info, 'InstructorsPage');
const InstructorDetailPage = named(info, 'InstructorDetailPage');
const ContactPage = named(info, 'ContactPage');
const AdminApplicationsPage = named(
  () => import('@/pages/admin/ApplicationAdminPages'),
  'AdminApplicationsPage',
);
const webinarPages = () => import('@/pages/public/WebinarPages');
const WebinarsPage = named(webinarPages, 'WebinarsPage');
const WebinarDetailPage = named(webinarPages, 'WebinarDetailPage');
const webinarAdmin = () => import('@/pages/admin/WebinarAdminPages');
const AdminWebinarsPage = named(webinarAdmin, 'AdminWebinarsPage');
const AdminWebinarFormPage = named(webinarAdmin, 'AdminWebinarFormPage');
const AdminWebinarRegistrationsPage = named(webinarAdmin, 'AdminWebinarRegistrationsPage');
const roadmap = () => import('@/pages/public/RoadmapPages');
const RoadmapsPage = named(roadmap, 'RoadmapsPage');
const RoadmapDetailPage = named(roadmap, 'RoadmapDetailPage');
const pathsAdmin = () => import('@/pages/admin/LearningPathAdminPages');
const AdminLearningPathsPage = named(pathsAdmin, 'AdminLearningPathsPage');
const AdminLearningPathFormPage = named(pathsAdmin, 'AdminLearningPathFormPage');
const academic = () => import('@/pages/admin/AcademicAdminPages');
const AdminProgramsPage = named(academic, 'AdminProgramsPage');
const AdminProgramFormPage = named(academic, 'AdminProgramFormPage');
const AdminInstructorsPage = named(academic, 'AdminInstructorsPage');
const AdminContactMessagesPage = named(academic, 'AdminContactMessagesPage');
const CurriculumManagerPage = lazy(() =>
  import('@/pages/admin/CurriculumManagerPage').then((m) => ({ default: m.CurriculumManagerPage })),
);
const instructor = () => import('@/pages/instructor/InstructorPages');
const InstructorDashboardPage = named(instructor, 'InstructorDashboardPage');
const InstructorProfilePage = named(instructor, 'InstructorProfilePage');
const DashboardLayout = named(() => import('@/components/layout/DashboardLayout'), 'DashboardLayout');
const student = () => import('@/pages/dashboard/StudentPages');
const StudentDashboardPage = named(student, 'StudentDashboardPage');
const ProfilePage = named(student, 'ProfilePage');
const admin = () => import('@/pages/admin/AdminPages');
const AdminIndexRedirect = named(admin, 'AdminIndexRedirect');
const AdminCategoriesPage = named(admin, 'AdminCategoriesPage');
const AdminUsersPage = named(admin, 'AdminUsersPage');
const AdminRolesPage = named(admin, 'AdminRolesPage');
const AdminAuditLogsPage = named(admin, 'AdminAuditLogsPage');
const AdminSettingsPage = named(admin, 'AdminSettingsPage');
const courseAdmin = () => import('@/pages/admin/CoursesAdminPages');
const AdminCoursesPage = named(courseAdmin, 'AdminCoursesPage');
const AdminCourseFormPage = named(courseAdmin, 'AdminCourseFormPage');

function PageFallback() {
  return (
    <div className="container py-12" aria-busy="true">
      <Skeleton className="mb-4 h-9 w-72" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

const S = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<PageFallback />}>{children}</Suspense>
);

export function AppRoutes() {
  return (
    <S>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="courses/:slug" element={<CourseDetailPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="webinars" element={<WebinarsPage />} />
          <Route path="webinars/:slug" element={<WebinarDetailPage />} />
          <Route path="roadmaps" element={<RoadmapsPage />} />
          <Route path="roadmaps/:slug" element={<RoadmapDetailPage />} />
          <Route path="programs" element={<ProgramsPage />} />
          <Route path="programs/:slug" element={<ProgramDetailPage />} />
          <Route path="instructors" element={<InstructorsPage />} />
          <Route path="instructors/:id" element={<InstructorDetailPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route element={<GuestOnlyRoute />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="student">
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<StudentDashboardPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="instructor">
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<InstructorDashboardPage />} />
              <Route path="profile" element={<InstructorProfilePage />} />
              <Route
                path="courses/:id/curriculum"
                element={<CurriculumManagerPage backTo={() => '/instructor/dashboard'} />}
              />
            </Route>
            <Route path="admin">
              <Route index element={<AdminIndexRedirect />} />
              <Route path="dashboard" element={<AdminIndexRedirect />} />
              <Route
                path="courses"
                element={
                  <PermissionGuard all={['courses.read']}>
                    <AdminCoursesPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="courses/new"
                element={
                  <PermissionGuard all={['courses.create']}>
                    <AdminCourseFormPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="courses/:id"
                element={
                  <PermissionGuard all={['courses.read']}>
                    <AdminCourseFormPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="courses/:id/curriculum"
                element={
                  <PermissionGuard all={['courses.read']}>
                    <CurriculumManagerPage backTo={(id) => `/admin/courses/${id}`} />
                  </PermissionGuard>
                }
              />
              <Route
                path="programs"
                element={
                  <PermissionGuard all={['programs.manage']}>
                    <AdminProgramsPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="programs/new"
                element={
                  <PermissionGuard all={['programs.manage']}>
                    <AdminProgramFormPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="programs/:id"
                element={
                  <PermissionGuard all={['programs.manage']}>
                    <AdminProgramFormPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="applications"
                element={
                  <PermissionGuard all={['applications.read']}>
                    <AdminApplicationsPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="webinars"
                element={
                  <PermissionGuard
                    any={[
                      'webinars.create',
                      'webinars.update',
                      'webinars.publish',
                      'webinars.cancel',
                      'webinar_registrations.manage',
                    ]}
                  >
                    <AdminWebinarsPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="webinars/new"
                element={
                  <PermissionGuard all={['webinars.create']}>
                    <AdminWebinarFormPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="webinars/:id"
                element={
                  <PermissionGuard
                    any={[
                      'webinars.create',
                      'webinars.update',
                      'webinars.publish',
                      'webinars.cancel',
                      'webinar_registrations.manage',
                    ]}
                  >
                    <AdminWebinarFormPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="webinars/:id/registrations"
                element={
                  <PermissionGuard all={['webinar_registrations.manage']}>
                    <AdminWebinarRegistrationsPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="learning-paths"
                element={
                  <PermissionGuard all={['learning_paths.manage']}>
                    <AdminLearningPathsPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="learning-paths/new"
                element={
                  <PermissionGuard all={['learning_paths.manage']}>
                    <AdminLearningPathFormPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="learning-paths/:id"
                element={
                  <PermissionGuard all={['learning_paths.manage']}>
                    <AdminLearningPathFormPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="instructors"
                element={
                  <PermissionGuard any={['instructors.read', 'instructors.manage', 'users.read']}>
                    <AdminInstructorsPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="contact-messages"
                element={
                  <PermissionGuard any={['cms.manage', 'settings.manage']}>
                    <AdminContactMessagesPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="categories"
                element={
                  <PermissionGuard any={['categories.manage', 'courses.update']}>
                    <AdminCategoriesPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="users"
                element={
                  <PermissionGuard all={['users.read']}>
                    <AdminUsersPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="roles"
                element={
                  <PermissionGuard all={['permissions.manage']}>
                    <AdminRolesPage />
                  </PermissionGuard>
                }
              />
              <Route path="permissions" element={<Navigate to="/admin/roles" replace />} />
              <Route
                path="audit-logs"
                element={
                  <PermissionGuard all={['audit_logs.read']}>
                    <AdminAuditLogsPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="settings"
                element={
                  <PermissionGuard all={['settings.manage']}>
                    <AdminSettingsPage />
                  </PermissionGuard>
                }
              />
            </Route>
          </Route>
        </Route>
      </Routes>
    </S>
  );
}
