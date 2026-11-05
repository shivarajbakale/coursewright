/**
 * API Response Types - MASTER TEMPLATE
 * Version: 1.0.0
 * Last Updated: 2025-01-26
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

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

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export interface BulkOperationResponse {
  success: boolean;
  updated: number;
  failed: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
}
