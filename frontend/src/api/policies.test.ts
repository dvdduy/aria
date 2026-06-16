import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

const { client } = vi.hoisted(() => ({
  client: {
    get: vi.fn(),
  },
}))

vi.mock('./client', () => ({
  default: client,
}))

import { policiesApi } from './policies'

describe('policiesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches active policy categories', async () => {
    const response = { categories: ['leave', 'payroll'] }
    ;(client.get as Mock).mockResolvedValueOnce({ data: response })

    await expect(policiesApi.getPolicyCategories()).resolves.toBe(response)

    expect(client.get).toHaveBeenCalledWith('/api/policies/categories')
  })

  it('fetches policy summaries without a query', async () => {
    const response = [{ id: 'policy-1', title: 'Annual Leave Policy' }]
    ;(client.get as Mock).mockResolvedValueOnce({ data: response })

    await expect(policiesApi.searchPolicies()).resolves.toBe(response)

    expect(client.get).toHaveBeenCalledWith('/api/policies', {
      params: undefined,
    })
  })

  it('fetches policy summaries with a trimmed query', async () => {
    const response = [{ id: 'policy-2', title: 'Payroll Policy' }]
    ;(client.get as Mock).mockResolvedValueOnce({ data: response })

    await expect(policiesApi.searchPolicies(' payroll ')).resolves.toBe(
      response,
    )

    expect(client.get).toHaveBeenCalledWith('/api/policies', {
      params: { query: 'payroll' },
    })
  })
})
