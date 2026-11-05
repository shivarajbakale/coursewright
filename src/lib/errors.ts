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

/** What went wrong, in the terms a person can act on. */
export type ErrorKind = 'offline' | 'missing' | 'server' | 'other';

/**
 * Sort a failed request into what the person can do about it: start the
 * service (offline), go elsewhere (missing), or try again (server, other).
 * The client reports a network failure as status 0.
 */
export function errorKind(error: unknown): ErrorKind {
  const status = isApiError(error) ? error.status : undefined;
  const message = getErrorMessage(error).toLowerCase();
  // 502-504 is a proxy (the dev server, a load balancer) saying the service behind it did not answer.
  if (status === 0 || status === 502 || status === 503 || status === 504) return 'offline';
  if (message.includes('network') || message.includes('failed to fetch')) return 'offline';
  if (status === 404) return 'missing';
  if (status !== undefined && status >= 500) return 'server';
  return 'other';
}

/** The server's own message, when it says more than a stock phrase. */
export function errorDetail(error: unknown): string | null {
  const message = getErrorMessage(error).trim();
  const stock = ['an error occurred', 'an unknown error occurred', 'an unexpected error occurred', 'internal server error'];
  if (!message || stock.includes(message.toLowerCase().replace(/[.!]$/, ''))) return null;
  if (message.toLowerCase().startsWith('network error')) return null;
  return message;
}
