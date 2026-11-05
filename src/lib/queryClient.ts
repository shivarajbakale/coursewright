import { QueryClient } from '@tanstack/react-query';

/**
 * Create and configure the React Query client with optimized defaults
 * for web applications
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable automatic refetching on window focus for desktop apps
      refetchOnWindowFocus: false,

      // Retry failed requests up to 2 times
      retry: 2,

      // Cache data for 5 minutes
      staleTime: 5 * 60 * 1000,

      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});
