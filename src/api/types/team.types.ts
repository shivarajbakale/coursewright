/**
 * Team / Member types — every row in the Team page table.
 *
 * `role` controls what the member can do:
 *   - 'owner'   full workspace control; only one per workspace
 *   - 'admin'   manage members + projects
 *   - 'member'  create / edit projects
 *   - 'viewer'  read-only
 *
 * `status` is the invite lifecycle:
 *   - 'active'   accepted the invite
 *   - 'invited'  email sent, not accepted yet
 *   - 'disabled' suspended
 */

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';
export type MemberStatus = 'active' | 'invited' | 'disabled';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  status: MemberStatus;
  avatarUrl?: string;
  /** Free-form seat label (e.g. "Engineering", "Design"). */
  team?: string;
  lastActiveAt?: string;
  joinedAt: string;
}

export interface InviteMemberDto {
  email: string;
  role: WorkspaceRole;
  team?: string;
}

export interface WorkspaceSeats {
  used: number;
  total: number;
  plan: 'free' | 'pro' | 'business';
}
