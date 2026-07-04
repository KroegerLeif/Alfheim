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
import { apiClient } from '@/lib/api'
import { vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  apiClient: {
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
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useInventoryState('p1', 'l1'), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/inventory/state', {
      params: { product_id: 'p1', location_id: 'l1' }
    })
  })

  it('useLowStockItems fetches low stock items correctly', async () => {
    const mockData = [
      { product: { id: 'p1', name: 'Oatly', minimum_stock: 1000 }, current_stock: 500 }
    ]
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useLowStockItems(), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/inventory/low-stock')
  })

  it('useExpirationSummary fetches expiration summary status correctly', async () => {
    const mockData = {
      expired: [{ product_id: 'p1', quantity: 10 }],
      valid: [{ product_id: 'p2', quantity: 20 }],
      untracked: []
    }
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useExpirationSummary(), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
  })

  it('exportLowStockShoppingList fetches stock list directly', async () => {
    const mockData = [{ product: { name: 'Sugar' }, current_stock: 0 }]
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockData })

    const list = await exportLowStockShoppingList()
    expect(list).toEqual(mockData)
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/inventory/low-stock')
  })

  it('useCreateTransaction posts transaction mutation successfully', async () => {
    const mockTx = { id: 'tx-1', quantity: 10.0 }
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockTx })

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
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/inventory/transactions', payload)
  })

  it('useLedgerHistory retrieves transaction log records', async () => {
    const mockData = [{ id: 'tx-1', quantity: 100.0, transaction_type: 'in' }]
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useLedgerHistory('p1', 'l1', 10, 0), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/inventory/transactions', {
      params: { product_id: 'p1', location_id: 'l1', limit: 10, offset: 0 }
    })
  })
})
