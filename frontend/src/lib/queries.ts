import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  MyWebinarRegistrationDto,
  PublicWebinarDto,
  PublicWebinarSummaryDto,
  PublicLearningPathDto,
  PublicLearningPathSummaryDto,
  CategoryDto,
  CurriculumOutlineDto,
  PublicCourseDto,
  PublicInstructorDetailDto,
  PublicInstructorDto,
  PublicProgramDto,
  PublicSiteSettings,
} from '@alifya/shared';
import { apiGet, apiGetPaged } from './api';

export const queryKeys = {
  settings: ['settings', 'public'] as const,
  categories: ['categories'] as const,
  courses: (params: object) => ['courses', params] as const,
  course: (slug: string) => ['course', slug] as const,
};

export const FALLBACK_SETTINGS: PublicSiteSettings = {
  academyName: 'Alifya Academy',
  tagline: '',
  logoUrl: null,
  contact: { email: null, phones: [], address: null },
  social: {},
  hero: { title: null, subtitle: null, imageUrl: null },
  about: {
    imageUrl: null,
    summary: null,
    introduction: null,
    mission: null,
    vision: null,
    approach: null,
    values: [],
    objectives: [],
  },
  defaultTimezone: 'Africa/Mogadishu',
  defaultCurrency: 'USD',
  supportedLanguages: ['en', 'so'],
};

export function useSiteSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiGet<PublicSiteSettings>('/settings/public'),
    staleTime: 5 * 60_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiGet<CategoryDto[]>('/categories'),
    staleTime: 5 * 60_000,
  });
}

export function useCourses(params: Record<string, string | number | undefined>) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  return useQuery({
    queryKey: queryKeys.courses(clean),
    queryFn: () => apiGetPaged<PublicCourseDto[]>('/courses', clean),
    placeholderData: keepPreviousData,
  });
}

export function useCourse(slug: string) {
  return useQuery({
    queryKey: queryKeys.course(slug),
    queryFn: () => apiGet<PublicCourseDto>(`/courses/${slug}`),
    retry: false,
  });
}

export function usePrograms(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['programs', params],
    queryFn: () => apiGetPaged<PublicProgramDto[]>('/programs', params),
    placeholderData: keepPreviousData,
  });
}
export function useProgram(slug: string) {
  return useQuery({
    queryKey: ['program', slug],
    queryFn: () => apiGet<PublicProgramDto>(`/programs/${slug}`),
    retry: false,
  });
}
export function useInstructors(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['instructors', params],
    queryFn: () => apiGetPaged<PublicInstructorDto[]>('/instructors', params),
    placeholderData: keepPreviousData,
  });
}
export function useInstructor(id: string) {
  return useQuery({
    queryKey: ['instructor', id],
    queryFn: () => apiGet<PublicInstructorDetailDto>(`/instructors/${id}`),
    retry: false,
  });
}
export function useCurriculumOutline(slug: string) {
  return useQuery({
    queryKey: ['curriculum', slug],
    queryFn: () => apiGet<CurriculumOutlineDto>(`/courses/${slug}/curriculum`),
    retry: false,
  });
}

export function useLearningPaths(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['learning-paths', params],
    queryFn: () => apiGetPaged<PublicLearningPathSummaryDto[]>('/learning-paths', params),
    placeholderData: keepPreviousData,
  });
}
export function useLearningPath(slug: string) {
  return useQuery({
    queryKey: ['learning-path', slug],
    queryFn: () => apiGet<PublicLearningPathDto>(`/learning-paths/${slug}`),
    retry: false,
  });
}

export function useWebinars(params: {
  when?: 'upcoming' | 'past';
  q?: string;
  topic?: string;
  page?: number;
  limit?: number;
}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  return useQuery({
    queryKey: ['webinars', clean],
    queryFn: () => apiGetPaged<PublicWebinarSummaryDto[]>('/webinars', clean),
    placeholderData: keepPreviousData,
  });
}
export function useWebinarTopics() {
  return useQuery({ queryKey: ['webinars', 'topics'], queryFn: () => apiGet<string[]>('/webinars/topics') });
}
export function useWebinar(slug: string) {
  return useQuery({
    queryKey: ['webinar', slug],
    queryFn: () => apiGet<PublicWebinarDto>(`/webinars/${slug}`),
    retry: false,
  });
}
export function useMyWebinarRegistration(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: ['webinar', slug, 'registration'],
    queryFn: () => apiGet<MyWebinarRegistrationDto>(`/webinars/${slug}/registration`),
    enabled,
    // Re-check periodically so the Join button appears when the join window opens.
    refetchInterval: 60_000,
  });
}
