/**
 * Customer API service.
 *
 * The single place that knows the customer HTTP endpoints. Methods return the
 * unwrapped domain type (via `extractData`). Query hooks call these — components
 * never call the service directly.
 */
import apiClient, { extractData } from '../client';
import type { ApiResponse, Customer, CreateCustomerDto, UpdateCustomerDto } from '../types';

export const customerService = {
  async list(): Promise<Customer[]> {
    const res = await apiClient.get<ApiResponse<Customer[]>>('/customers');
    return extractData(res);
  },

  async get(id: string): Promise<Customer> {
    const res = await apiClient.get<ApiResponse<Customer>>(`/customers/${id}`);
    return extractData(res);
  },

  async create(data: CreateCustomerDto): Promise<Customer> {
    const res = await apiClient.post<ApiResponse<Customer>>('/customers', data);
    return extractData(res);
  },

  async update(id: string, data: UpdateCustomerDto): Promise<Customer> {
    const res = await apiClient.patch<ApiResponse<Customer>>(`/customers/${id}`, data);
    return extractData(res);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/customers/${id}`);
  },
};
