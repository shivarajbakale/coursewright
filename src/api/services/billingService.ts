/**
 * Billing API service.
 */
import apiClient, { extractData } from '../client';
import type {
  ApiResponse,
  Invoice,
  PaymentMethod,
  Plan,
  PlanId,
  Subscription,
} from '../types';

export const billingService = {
  async plans(): Promise<Plan[]> {
    const res = await apiClient.get<ApiResponse<Plan[]>>('/billing/plans');
    return extractData(res);
  },
  async subscription(): Promise<Subscription> {
    const res = await apiClient.get<ApiResponse<Subscription>>('/billing/subscription');
    return extractData(res);
  },
  async invoices(): Promise<Invoice[]> {
    const res = await apiClient.get<ApiResponse<Invoice[]>>('/billing/invoices');
    return extractData(res);
  },
  async paymentMethod(): Promise<PaymentMethod | null> {
    const res = await apiClient.get<ApiResponse<PaymentMethod | null>>('/billing/payment-method');
    return extractData(res);
  },
  /** Switch plan (mock — no real charge). */
  async switchPlan(plan: PlanId): Promise<Subscription> {
    const res = await apiClient.post<ApiResponse<Subscription>>('/billing/switch', { plan });
    return extractData(res);
  },
};
