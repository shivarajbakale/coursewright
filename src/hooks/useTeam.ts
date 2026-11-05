/**
 * Team query & mutation hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/notify';

import { teamService } from '@/api/services/teamService';

export const teamKeys = {
  all: ['team'] as const,
  list: () => [...teamKeys.all, 'list'] as const,
  seats: () => [...teamKeys.all, 'seats'] as const,
};

export function useTeam() {
  return useQuery({ queryKey: teamKeys.list(), queryFn: () => teamService.list() });
}

export function useSeats() {
  return useQuery({ queryKey: teamKeys.seats(), queryFn: () => teamService.seats() });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teamService.invite,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      toast.success('Invite sent');
    },
    onError: () => toast.error('Could not send invite'),
  });
}

/**
 * Invite several people in one submit.
 *
 * The single-member `useInviteMember` is still the right hook for one address;
 * this one exists because the dialog now takes a list, and N invites through it
 * would fire N toasts for one action the user took once. The requests go in
 * sequence rather than in parallel: an invite endpoint is rate-limited far more
 * often than it is fast, and a burst of five is how a demo finds that out.
 */
export function useInviteMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invites: Parameters<typeof teamService.invite>[0][]) => {
      const sent = [];
      for (const invite of invites) sent.push(await teamService.invite(invite));
      return sent;
    },
    onSuccess: sent => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      toast.success(sent.length === 1 ? 'Invite sent' : `${sent.length} invites sent`);
    },
    onError: () => toast.error('Could not send the invites'),
  });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      role,
    }: {
      id: string;
      role: Parameters<typeof teamService.changeRole>[1];
    }) => teamService.changeRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      toast.success('Role updated');
    },
    onError: () => toast.error('Could not update role'),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teamService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      toast.success('Member removed');
    },
    onError: () => toast.error('Could not remove member'),
  });
}
