import client from './client'
import type { HRPolicy, HRPolicySummary } from '@/types/models'

export interface PolicyCategoriesResponse {
  categories: string[]
}

export interface PolicyWriteBody {
  title: string
  category: string
  content: string
  version: string
  effective_date: string | null
}

export const policiesApi = {
  async getPolicyCategories() {
    const { data } = await client.get<PolicyCategoriesResponse>(
      '/api/policies/categories',
    )
    return data
  },

  async searchPolicies(query = '') {
    const trimmedQuery = query.trim()
    const { data } = await client.get<HRPolicySummary[]>('/api/policies', {
      params: trimmedQuery ? { query: trimmedQuery } : undefined,
    })
    return data
  },

  async getPolicy(id: string) {
    const { data } = await client.get<HRPolicy>(`/api/policies/${id}`)
    return data
  },

  async createPolicy(body: PolicyWriteBody) {
    const { data } = await client.post<HRPolicy>('/api/policies', body)
    return data
  },

  async updatePolicy(id: string, body: PolicyWriteBody) {
    const { data } = await client.put<HRPolicy>(`/api/policies/${id}`, body)
    return data
  },

  async deletePolicy(id: string) {
    await client.delete(`/api/policies/${id}`)
  },
}
