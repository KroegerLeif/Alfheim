import React from 'react'
import { render, screen } from '@testing-library/react'
import { AnalyticsView } from '../AnalyticsView'
import { useInventoryState, useLedgerHistory } from '@/features/inventory/services/inventoryService'
import { useCategories } from '@/features/categories/services/categoryService'
import { createQueryWrapper } from '@/tests/utils'
import { vi, Mock } from 'vitest'

vi.mock('@/features/inventory/services/inventoryService', () => ({
  useInventoryState: vi.fn(),
  useLedgerHistory: vi.fn(),
}))

vi.mock('@/features/categories/services/categoryService', () => ({
  useCategories: vi.fn(),
}))

describe('AnalyticsView Component', () => {
  const mockCategories = [
    { id: 'cat-1', name: 'Fruits' },
    { id: 'cat-2', name: 'Dairy' },
  ]

  const mockInventoryStates = [
    { id: 's1', product_id: 'p1', quantity: 10, product: { category_id: 'cat-1' } },
    { id: 's2', product_id: 'p2', quantity: 5, product: { category_id: 'cat-2' } },
    { id: 's3', product_id: 'p3', quantity: 2.5, product: { category_id: 'cat-1' } },
    { id: 's4', product_id: 'p4', quantity: 1, product: { category_id: null } }, // uncategorized
  ]

  // Create transactions spread across the last few months
  const now = new Date()
  const mockTransactions = [
    { id: 'tx1', transaction_type: 'out', quantity: 5, created_at: now.toISOString() }, // Current month
    { id: 'tx2', transaction_type: 'waste', quantity: 2, created_at: new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString() }, // 1 Month ago
    { id: 'tx3', transaction_type: 'in', quantity: 20, created_at: now.toISOString() }, // IN transaction, should be ignored by consumption
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    ;(useInventoryState as Mock).mockReturnValue({ data: mockInventoryStates, isLoading: false })
    ;(useCategories as Mock).mockReturnValue({ data: mockCategories, isLoading: false })
    ;(useLedgerHistory as Mock).mockReturnValue({ data: mockTransactions, isLoading: false })
  })

  it('renders title, subtitle and dual panel charting headers', () => {
    render(<AnalyticsView />, { wrapper: createQueryWrapper() })

    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('subtitle')).toBeInTheDocument()
    expect(screen.getByText('consumptionTitle')).toBeInTheDocument()
    expect(screen.getByText('categoryTitle')).toBeInTheDocument()
  })

  it('calculates current stock by category and aggregates correctly', () => {
    render(<AnalyticsView />, { wrapper: createQueryWrapper() })

    // Fruits: s1 (10) + s3 (2.5) = 12.5
    expect(screen.getByText('FRUITS')).toBeInTheDocument()
    expect(screen.getByText((content, el) => el?.textContent?.trim().replace(/\s+/g, ' ') === '12.5 items')).toBeInTheDocument()

    // Dairy: s2 (5) = 5.0
    expect(screen.getByText('DAIRY')).toBeInTheDocument()
    expect(screen.getByText((content, el) => el?.textContent?.trim().replace(/\s+/g, ' ') === '5 items')).toBeInTheDocument()

    // Uncategorized: s4 (1) = 1.0
    expect(screen.getByText('NOCATEGORY')).toBeInTheDocument()
    expect(screen.getByText((content, el) => el?.textContent?.trim().replace(/\s+/g, ' ') === '1 items')).toBeInTheDocument()
  })

  it('aggregates and displays monthly consumption from out/waste ledger logs', () => {
    render(<AnalyticsView />, { wrapper: createQueryWrapper() })

    // Current month should have 5 (from tx1)
    const currentMonthLabel = now.toLocaleString('en-US', { month: 'short' }).toUpperCase()
    expect(screen.getByText(currentMonthLabel)).toBeInTheDocument()

    // Previous month should have 2 (from tx2)
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthLabel = prevMonthDate.toLocaleString('en-US', { month: 'short' }).toUpperCase()
    expect(screen.getByText(prevMonthLabel)).toBeInTheDocument()
  })

  it('renders placeholders when there is no data', () => {
    ;(useInventoryState as Mock).mockReturnValue({ data: [], isLoading: false })
    ;(useLedgerHistory as Mock).mockReturnValue({ data: [], isLoading: false })

    render(<AnalyticsView />, { wrapper: createQueryWrapper() })

    expect(screen.getByText('noData')).toBeInTheDocument()
    expect(screen.getByText('noStockData')).toBeInTheDocument()
  })
})
