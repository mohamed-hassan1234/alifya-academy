import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PublicCourseDto } from '@alifya/shared';
import { CourseCard } from './CourseCard';

const course: PublicCourseDto = {
  id: '1',
  title: 'Introduction to Data Science',
  slug: 'intro-data',
  subtitle: 'Learn by doing',
  description: '',
  thumbnailUrl: null,
  category: { name: 'Data', slug: 'data' },
  instructors: [{ id: 'i', fullName: 'Dr. Farah', avatarUrl: null }],
  feeAmount: 0,
  currency: 'USD',
  isFree: true,
  durationText: '8 weeks',
  startDate: '2026-03-09T21:00:00.000Z',
  endDate: null,
  schedule: [],
  timezone: 'Africa/Mogadishu',
  level: 'beginner',
  language: 'en',
  learningObjectives: [],
  entryRequirements: [],
  capacity: 20,
  seatsRemaining: 3,
  registrationOpensAt: null,
  registrationClosesAt: null,
  displayStatus: 'registration_open',
  registrationOpen: true,
  featured: false,
};

describe('CourseCard', () => {
  it('renders real course data with an accessible link', () => {
    render(
      <MemoryRouter>
        <CourseCard course={course} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Introduction to Data Science' })).toHaveAttribute(
      'href',
      '/courses/intro-data',
    );
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Registration open')).toBeInTheDocument();
    expect(screen.getByText('3 seats left')).toBeInTheDocument();
    expect(screen.getByText('Dr. Farah')).toBeInTheDocument();
    // Date shown in the course timezone, not the test machine's.
    expect(screen.getByText('10 Mar 2026')).toBeInTheDocument();
  });
  it('shows formatted price for paid courses', () => {
    render(
      <MemoryRouter>
        <CourseCard course={{ ...course, isFree: false, feeAmount: 15000 }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('US$150')).toBeInTheDocument();
  });
});
