/**
 * Error Handling Utilities
 *
 * Centralized error types and utilities for consistent error handling
 * across the application.
 */

/**
 * API Error interface
 * Represents errors returned from API calls
 */
export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
}

/**
 * JSON-serializable value type
 * Used for type-safe JSON handling
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiError).message === 'string'
  );
}

/**
 * Type guard to check if an error is a standard Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown error type
 *
 * @param error - Unknown error object
 * @returns Human-readable error message
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }

  if (isError(error)) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unknown error occurred';
}

/**
 * Format error for display with additional context
 *
 * @param error - Unknown error object
 * @param context - Additional context about where the error occurred
 * @returns Formatted error message
 */
export function formatError(error: unknown, context?: string): string {
  const message = getErrorMessage(error);
  return context ? `${context}: ${message}` : message;
}
