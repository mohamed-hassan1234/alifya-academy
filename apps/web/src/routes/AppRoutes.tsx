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
                path="categories"
                element={
                  <PermissionGuard all={['courses.update']}>
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
