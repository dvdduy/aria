import client from './client'
import type { HRPolicySummary } from '@/types/models'

export interface PolicyCategoriesResponse {
  categories: string[]
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
}
