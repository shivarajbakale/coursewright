/**
 * Axios HTTP Client Configuration
 *
 * Configured with:
 * - Base URL from environment variables
 * - Request/Response interceptors
 * - Error handling
 * - Request logging in development
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { signOut } from '@/lib/auth';
import type { ApiError, ApiResponse } from './types';

// Create axios instance with base configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000, // 30 seconds
  withCredentials: true, // send cookies for Better Auth sessions
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor
 * - Logs requests in development
 * - Can be extended to add auth tokens when needed
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      });
    }

    // Future: Add auth token here when implementing authentication
    // const token = getAccessToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }

    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * - Logs responses in development
 * - Handles errors globally
 * - Transforms API responses
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log responses in development
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }

    return response;
  },
  async (error: AxiosError<ApiError>) => {
    // Log errors in development
    if (import.meta.env.DEV) {
      console.error('[API Error]', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    // Handle specific error cases
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 400:
          // Bad Request - validation errors
          console.error('Validation Error:', data.message);
          break;

        case 401:
          // Unauthorized — clear stale session and redirect to login
          console.error('Unauthorized:', data.message);
          try { await signOut(); } catch { /* ignore signout errors */ }
          window.location.href = '/login';
          break;

        case 403:
          // Forbidden
          console.error('Forbidden:', data.message);
          break;

        case 404:
          // Not Found
          console.error('Not Found:', data.message);
          break;

        case 500:
          // Internal Server Error
          console.error('Server Error:', data.message);
          break;

        default:
          console.error('API Error:', data.message);
      }

      // Return formatted error
      return Promise.reject({
        message: data.message || 'An error occurred',
        errors: data.errors,
        status,
      });
    } else if (error.request) {
      // Request made but no response received
      console.error('Network Error: No response received');
      return Promise.reject({
        message: 'Network error: Unable to reach the server',
        status: 0,
      });
    } else {
      // Something else happened
      console.error('Request Error:', error.message);
      return Promise.reject({
        message: error.message || 'An unexpected error occurred',
        status: 0,
      });
    }
  }
);

/**
 * Utility function to extract data from API response
 * Handles both wrapped responses (ApiResponse<T>) and direct responses (T)
 * Flexible to work with different response formats:
 * - { success: true, data: T } (frontend format)
 * - { data: T, meta: {...} } (backend format)
 * - T (direct data)
 */
export function extractData<T>(response: AxiosResponse<ApiResponse<T> | T>): T {
  const data = response.data;

  // Check if response is wrapped (either 'success' or 'meta' format)
  if (data && typeof data === 'object' && 'data' in data) {
    // Don't require specific fields, just extract 'data'.
    return (data as ApiResponse<T>).data;
  }

  // Return data directly if not wrapped
  return data as T;
}

/**
 * Utility function to handle API errors consistently
 */
export function handleApiError(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: unknown } }).response === 'object' &&
    (error as { response?: { data?: unknown } }).response !== null &&
    'data' in ((error as { response: { data?: unknown } }).response)
  ) {
    throw (error as { response: { data: unknown } }).response.data;
  }
  throw error;
}

export default apiClient;
