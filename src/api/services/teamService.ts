/**
 * Team API service.
 */
import apiClient, { extractData } from '../client';
import type { ApiResponse, Member, WorkspaceSeats, InviteMemberDto, WorkspaceRole } from '../types';

export const teamService = {
  async list(): Promise<Member[]> {
    const res = await apiClient.get<ApiResponse<Member[]>>('/team');
    return extractData(res);
  },
  async seats(): Promise<WorkspaceSeats> {
    const res = await apiClient.get<ApiResponse<WorkspaceSeats>>('/team/seats');
    return extractData(res);
  },
  async invite(data: InviteMemberDto): Promise<Member> {
    const res = await apiClient.post<ApiResponse<Member>>('/team/invite', data);
    return extractData(res);
  },
  async changeRole(id: string, role: WorkspaceRole): Promise<Member> {
    const res = await apiClient.patch<ApiResponse<Member>>(`/team/${id}`, { role });
    return extractData(res);
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/team/${id}`);
  },
};
