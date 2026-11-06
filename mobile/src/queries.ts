/**
 * Query hooks for the reader. Same rule as the web app: screens read server state only through a
 * hook that calls a service in src/api/services, so every call is cached and has an MSW handler.
 */
import { useQuery } from '@tanstack/react-query';
import { courseService } from '@/api/services/coursewrightService';

export const readerKeys = {
  courses: ['reader', 'courses'] as const,
};

export function useCourses() {
  return useQuery({ queryKey: readerKeys.courses, queryFn: courseService.list });
}
