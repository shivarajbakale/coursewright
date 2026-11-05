/**
 * Billing query & mutation hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/notify';

import { billingService } from '@/api/services/billingService';
import type { PlanId } from '@/api/types';

export const billingKeys = {
  all: ['billing'] as const,
  plans: () => [...billingKeys.all, 'plans'] as const,
  subscription: () => [...billingKeys.all, 'subscription'] as const,
  invoices: () => [...billingKeys.all, 'invoices'] as const,
  paymentMethod: () => [...billingKeys.all, 'payment-method'] as const,
};

export function usePlans() {
  return useQuery({ queryKey: billingKeys.plans(), queryFn: () => billingService.plans() });
}

export function useSubscription() {
  return useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: () => billingService.subscription(),
  });
}

export function useInvoices() {
  return useQuery({ queryKey: billingKeys.invoices(), queryFn: () => billingService.invoices() });
}

export function usePaymentMethod() {
  return useQuery({ queryKey: billingKeys.paymentMethod(), queryFn: () => billingService.paymentMethod() });
}

export function useSwitchPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: PlanId) => billingService.switchPlan(plan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billingKeys.all });
      toast.success('Plan updated');
    },
    onError: () => toast.error('Could not switch plan'),
  });
}
