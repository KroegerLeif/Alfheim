import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  useActiveHouseholdId,
  useChoreTemplates,
  useTodayChores,
  useChoreSummary,
  useCreateChoreTemplate,
  useAssignChoreInstance,
  useCompleteChoreInstance,
  useDeleteChoreTemplate,
  useTaskTimeline,
} from '../choresService'
import { useShoppingIntegration } from '../integrationService'
import { ChoreTemplateRead, ChoreInstanceRead } from '../../types'
import { createTestQueryClient } from '../../../../tests/test-utils'

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('choresService Hooks', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    localStorage.clear()
    localStorage.setItem('alfheim_active_household_id', 'hh-1')
  })

  it('useActiveHouseholdId responds to localStorage and custom events', () => {
    const { result } = renderHook(() => useActiveHouseholdId())
    expect(result.current).toBe('hh-1')

    act(() => {
      localStorage.setItem('alfheim_active_household_id', 'hh-2')
      window.dispatchEvent(new Event('storage-household-changed'))
    })

    expect(result.current).toBe('hh-2')
  })

  it('useChoreTemplates fetches chore templates via MSW', async () => {
    const { result } = renderHook(() => useChoreTemplates(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })

    expect(result.current.data).toBeDefined()
    expect(result.current.data?.length).toBe(2)
    expect(result.current.data?.[0].name).toBe('Vacuum Living Room')
  })

  it('useTodayChores fetches instances for the selected date', async () => {
    const { result } = renderHook(() => useTodayChores('2026-08-16'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })

    expect(result.current.data).toBeDefined()
    expect(result.current.data?.length).toBe(2)
    expect(result.current.data?.[0].status).toBe('pending')
  })

  it('useChoreSummary fetches integration summary metrics', async () => {
    const { result } = renderHook(() => useChoreSummary(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })

    expect(result.current.data).toBeDefined()
    expect(result.current.data?.current_streak).toBe(5)
    expect(result.current.data?.completion_rate).toBe(50)
  })

  it('useCreateChoreTemplate successfully posts a new template', async () => {
    const { result } = renderHook(() => useCreateChoreTemplate(), {
      wrapper: createWrapper(queryClient),
    })

    let createdData: ChoreTemplateRead | null = null
    await act(async () => {
      createdData = await result.current.mutateAsync({
        name: 'Take out Trash',
        description: 'Recycling and compost',
        points: 10,
        is_non_cumulative: true,
      })
    })

    expect(createdData).toBeDefined()
    const template = createdData as ChoreTemplateRead | null
    expect(template?.name).toBe('Take out Trash')
    expect(template?.id).toBe('tpl-new')
  })

  it('useAssignChoreInstance updates chore assignee with optimistic update', async () => {
    const { result } = renderHook(() => useAssignChoreInstance(), {
      wrapper: createWrapper(queryClient),
    })

    let assignedData: ChoreInstanceRead | null = null
    await act(async () => {
      assignedData = await result.current.mutateAsync({
        id: 'inst-1',
        assignedTo: 'user-2',
        dueDate: '2026-08-16',
      })
    })

    expect(assignedData).toBeDefined()
    const instance = assignedData as ChoreInstanceRead | null
    expect(instance?.assigned_to).toBe('user-2')
  })

  it('useCompleteChoreInstance completes chore instance', async () => {
    const { result } = renderHook(() => useCompleteChoreInstance(), {
      wrapper: createWrapper(queryClient),
    })

    let completedData: ChoreInstanceRead | null = null
    await act(async () => {
      completedData = await result.current.mutateAsync({
        id: 'inst-1',
        dueDate: '2026-08-16',
      })
    })

    expect(completedData).toBeDefined()
    const completedInstance = completedData as ChoreInstanceRead | null
    expect(completedInstance?.status).toBe('completed')
  })

  it('useDeleteChoreTemplate successfully deletes template', async () => {
    const { result } = renderHook(() => useDeleteChoreTemplate(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync('tpl-1')
    })

    expect(result.current.isSuccess).toBe(true)
  })

  it('useTaskTimeline fetches execution history timeline for template', async () => {
    const { result } = renderHook(() => useTaskTimeline('tpl-1'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })

    expect(result.current.data).toBeDefined()
    expect(result.current.data?.length).toBe(1)
    expect(result.current.data?.[0].completed_by_name).toBe('Alice')
  })

  it('useShoppingIntegration fetches pending shopping list counts', async () => {
    const { result } = renderHook(() => useShoppingIntegration(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })

    expect(result.current.data).toBeDefined()
    expect(result.current.data?.pendingCount).toBe(1)
    expect(result.current.data?.totalLists).toBe(1)
  })
})
