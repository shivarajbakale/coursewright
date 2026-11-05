/**
 * Customer query & mutation hooks (TanStack Query).
 *
 * Components use these — not the service or axios — so caching, refetching, and
 * invalidation are handled in one place. `customerKeys` keeps query keys
 * consistent between reads and invalidations.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/notify';
import { customerService } from '@/api/services/customerService';
import type { CreateCustomerDto, UpdateCustomerDto } from '@/api/types';

export const customerKeys = {
  all: ['customers'] as const,
  list: () => [...customerKeys.all, 'list'] as const,
  detail: (id: string) => [...customerKeys.all, 'detail', id] as const,
};

export function useCustomers() {
  return useQuery({
    queryKey: customerKeys.list(),
    queryFn: () => customerService.list(),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => customerService.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomerDto) => customerService.create(data),
    onSuccess: (customer) => {
      qc.invalidateQueries({ queryKey: customerKeys.all });
      toast.success(`${customer.name} added`);
    },
    onError: () => toast.error('Could not add customer'),
  });
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateCustomerDto) => customerService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.all });
      toast.success('Customer updated');
    },
    onError: () => toast.error('Could not update customer'),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.all });
      toast.success('Customer removed');
    },
    onError: () => toast.error('Could not remove customer'),
  });
}
