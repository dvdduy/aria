import client from './client'

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
}
