import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { CategoryDto, PublicCourseDto, PublicSiteSettings } from '@alifya/shared';
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
  about: { summary: null },
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
