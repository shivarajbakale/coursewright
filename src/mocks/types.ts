/**
 * Common types for MSW handlers
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * API Error response
 */
export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  code?: string;
  statusCode?: number;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T = unknown> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Type guard for API errors
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'success' in error &&
    error.success === false &&
    'message' in error &&
    typeof (error as ApiError).message === 'string'
  );
}

/**
 * Extract error message from various error formats
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }

  // Check for axios-style error
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response === 'object' &&
    (error as { response?: { data?: { message?: string } } }).response !== null
  ) {
    const axiosError = error as { response: { data?: { message?: string } } };
    if (axiosError.response.data?.message) {
      return axiosError.response.data.message;
    }
  }

  // Check for standard Error object
  if (error instanceof Error) {
    return error.message;
  }

  // Check for object with message property
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  return 'An unexpected error occurred';
}
