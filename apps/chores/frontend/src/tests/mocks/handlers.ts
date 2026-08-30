import { http, HttpResponse } from 'msw'
import { ChoreTemplateRead, ChoreInstanceRead, ChoreIntegrationSummary, ChoreTimelineRead } from '../../features/chore_management/types'

export const mockTemplates: ChoreTemplateRead[] = [
  {
    id: 'tpl-1',
    home_id: 'hh-1',
    name: 'Vacuum Living Room',
    description: 'Clean the carpet and rug',
    points: 15,
    is_non_cumulative: true,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  },
  {
    id: 'tpl-2',
    home_id: 'hh-1',
    name: 'Wash Dishes',
    description: 'Clean pots and pans in the sink',
    points: 10,
    is_non_cumulative: false,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  },
]

export const mockInstances: ChoreInstanceRead[] = [
  {
    id: 'inst-1',
    template_id: 'tpl-1',
    home_id: 'hh-1',
    assigned_to: 'user-1',
    completed_by: null,
    completed_at: null,
    due_date: '2026-08-16',
    status: 'pending',
    points_awarded: 15,
    created_at: '2026-08-16T00:00:00Z',
    updated_at: '2026-08-16T00:00:00Z',
  },
  {
    id: 'inst-2',
    template_id: 'tpl-2',
    home_id: 'hh-1',
    assigned_to: null,
    completed_by: 'user-2',
    completed_at: '2026-08-16T12:00:00Z',
    due_date: '2026-08-16',
    status: 'completed',
    points_awarded: 10,
    created_at: '2026-08-16T00:00:00Z',
    updated_at: '2026-08-16T12:00:00Z',
  },
]

export const mockSummary: ChoreIntegrationSummary = {
  home_id: 'hh-1',
  current_streak: 5,
  longest_streak: 12,
  today_completed_count: 1,
  today_pending_count: 1,
  today_total_count: 2,
  completion_rate: 50,
  today_chores: mockInstances,
}

export const mockTimeline: ChoreTimelineRead[] = [
  {
    id: 'time-1',
    template_id: 'tpl-1',
    instance_id: 'inst-old',
    home_id: 'hh-1',
    completed_by: 'user-1',
    completed_by_name: 'Alice',
    completed_at: '2026-08-15T18:00:00Z',
    points_awarded: 15,
  },
]

export const handlers = [
  http.get(/\/templates$/, () => {
    return HttpResponse.json(mockTemplates)
  }),

  http.post(/\/templates$/, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      {
        id: 'tpl-new',
        home_id: 'hh-1',
        name: body.name,
        description: body.description ?? null,
        points: body.points ?? 10,
        is_non_cumulative: body.is_non_cumulative ?? true,
        created_at: '2026-08-16T00:00:00Z',
        updated_at: '2026-08-16T00:00:00Z',
      },
      { status: 201 }
    )
  }),

  http.delete(/\/templates\/[^\/]+$/, () => {
    return HttpResponse.json({ success: true })
  }),

  http.get(/\/today/, () => {
    return HttpResponse.json(mockInstances)
  }),

  http.post(/\/instances\/([^\/]+)\/assign/, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const id = params[0] as string
    return HttpResponse.json({
      ...mockInstances[0],
      id,
      assigned_to: body.assigned_to,
    })
  }),

  http.post(/\/instances\/([^\/]+)\/complete/, ({ params }) => {
    const id = params[0] as string
    return HttpResponse.json({
      ...mockInstances[0],
      id,
      status: 'completed',
      completed_at: '2026-08-16T15:00:00Z',
    })
  }),

  http.get(/\/integrations\/summary/, () => {
    return HttpResponse.json(mockSummary)
  }),

  http.get(/\/templates\/[^\/]+\/timeline/, () => {
    return HttpResponse.json(mockTimeline)
  }),

  http.get(/\/shopping-lists/, () => {
    return HttpResponse.json([
      {
        id: 'list-1',
        name: 'Weekly Groceries',
        items: [
          { id: 'item-1', name: 'Apples', is_completed: false },
          { id: 'item-2', name: 'Bread', is_completed: true },
        ],
      },
    ])
  }),

  http.get(/\/maintenance\/summary/, () => {
    return HttpResponse.json([
      {
        total_devices: 4,
        total_overdue: 1,
        total_due_soon: 0,
      },
    ])
  }),
]
