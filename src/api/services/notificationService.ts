/**
 * Notification API service.
 *
 * Same shape as projectService — the only thing it knows is the HTTP shape
 * (`/api/notifications*`). Query hooks call these; the bell and the inbox
 * never call the service directly.
 */
import apiClient, { extractData } from '../client';
import type { ApiResponse, Notification } from '../types';

export const notificationService = {
  /** Latest notifications first. */
  async list(): Promise<Notification[]> {
    const res = await apiClient.get<ApiResponse<Notification[]>>('/notifications');
    return extractData(res);
  },

  async markRead(id: string): Promise<Notification> {
    const res = await apiClient.patch<ApiResponse<Notification>>(`/notifications/${id}`, {
      read: true,
    });
    return extractData(res);
  },

  async markAllRead(): Promise<{ updated: number }> {
    const res = await apiClient.post<ApiResponse<{ updated: number }>>(
      '/notifications/mark-all-read',
      {}
    );
    return extractData(res);
  },
};
