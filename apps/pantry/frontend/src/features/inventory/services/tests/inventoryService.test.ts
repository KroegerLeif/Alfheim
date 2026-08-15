import { renderHook, waitFor } from '@testing-library/react'
import {
  useInventoryState,
  useLowStockItems,
  useExpirationSummary,
  useCreateTransaction,
  useLedgerHistory,
  exportLowStockShoppingList
} from '../inventoryService'
import { createQueryWrapper } from '@/tests/utils'
import { pantryClient } from '@/core/api'
import { vi } from 'vitest'

vi.mock('@/core/api', () => ({
  pantryClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('Inventory Hooks Service', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('useInventoryState fetches filtered inventory state correctly', async () => {
    const mockData = [
      { id: '1', quantity: 500.0, product_id: 'p1', location_id: 'l1', product: { name: 'Oatly' }, location: { name: 'Backlog' } }
    ]
    const mockJson = vi.fn().mockResolvedValue(mockData)
    vi.mocked(pantryClient.get).mockReturnValue({
      json: mockJson,
    } as any)

    const { result } = renderHook(() => useInventoryState('p1', 'l1'), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
    expect(pantryClient.get).toHaveBeenCalledWith('api/v1/inventory/state', {
      searchParams: { product_id: 'p1', location_id: 'l1' }
    })
  })

  it('useLowStockItems fetches low stock items correctly', async () => {
    const mockData = [
      { product: { id: 'p1', name: 'Oatly', minimum_stock: 1000 }, current_stock: 500 }
    ]
    const mockJson = vi.fn().mockResolvedValue(mockData)
    vi.mocked(pantryClient.get).mockReturnValue({
      json: mockJson,
    } as any)

    const { result } = renderHook(() => useLowStockItems(), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
    expect(pantryClient.get).toHaveBeenCalledWith('api/v1/inventory/low-stock')
  })

  it('useExpirationSummary fetches expiration summary status correctly', async () => {
    const mockData = {
      expired: [{ product_id: 'p1', quantity: 10 }],
      valid: [{ product_id: 'p2', quantity: 20 }],
      untracked: []
    }
    const mockJson = vi.fn().mockResolvedValue(mockData)
    vi.mocked(pantryClient.get).mockReturnValue({
      json: mockJson,
    } as any)

    const { result } = renderHook(() => useExpirationSummary(), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
  })

  it('exportLowStockShoppingList fetches stock list directly', async () => {
    const mockData = [{ product: { name: 'Sugar' }, current_stock: 0 }]
    const mockJson = vi.fn().mockResolvedValue(mockData)
    vi.mocked(pantryClient.get).mockReturnValue({
      json: mockJson,
    } as any)

    const list = await exportLowStockShoppingList()
    expect(list).toEqual(mockData)
    expect(pantryClient.get).toHaveBeenCalledWith('api/v1/inventory/low-stock')
  })

  it('useCreateTransaction posts transaction mutation successfully', async () => {
    const mockTx = { id: 'tx-1', quantity: 10.0 }
    const mockJson = vi.fn().mockResolvedValue(mockTx)
    vi.mocked(pantryClient.post).mockReturnValue({
      json: mockJson,
    } as any)

    const { result } = renderHook(() => useCreateTransaction(), {
      wrapper: createQueryWrapper(),
    })

    const payload = {
      product_id: 'p1',
      location_id: 'l1',
      transaction_type: 'in' as const,
      quantity_input: 10,
      unit_input: 'piece'
    }

    result.current.mutate(payload)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockTx)
    expect(pantryClient.post).toHaveBeenCalledWith('api/v1/inventory/transactions', { json: payload })
  })

  it('useLedgerHistory retrieves transaction log records', async () => {
    const mockData = [{ id: 'tx-1', quantity: 100.0, transaction_type: 'in' }]
    const mockJson = vi.fn().mockResolvedValue(mockData)
    vi.mocked(pantryClient.get).mockReturnValue({
      json: mockJson,
    } as any)

    const { result } = renderHook(() => useLedgerHistory('p1', 'l1', 10, 0), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
    expect(pantryClient.get).toHaveBeenCalledWith('api/v1/inventory/transactions', {
      searchParams: { product_id: 'p1', location_id: 'l1', limit: 10, offset: 0 }
    })
  })
})
