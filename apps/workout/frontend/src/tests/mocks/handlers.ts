import { http, HttpResponse } from 'msw'

export const mockEquipment = [
  {
    id: 'equip-1',
    scope: 'household',
    home_id: 'hh-1',
    owner_user_id: null,
    name: 'Adjustable Dumbbells',
    category: 'free_weights',
    is_active: true,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  },
  {
    id: 'equip-2',
    scope: 'system',
    home_id: null,
    owner_user_id: null,
    name: 'Barbell',
    category: 'free_weights',
    is_active: true,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  },
]

export const mockExercises = [
  {
    id: 'ex-1',
    scope: 'household',
    home_id: 'hh-1',
    owner_user_id: null,
    name: 'Bench Press',
    primary_muscle: 'chest',
    secondary_muscles: ['shoulders', 'triceps'],
    equipment_id: 'equip-2',
    default_unit: 'kg',
    instructions: 'Lower the bar to your chest, then press back up.',
    is_active: true,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  },
  {
    id: 'ex-2',
    scope: 'system',
    home_id: null,
    owner_user_id: null,
    name: 'Squat',
    primary_muscle: 'quads',
    secondary_muscles: ['glutes', 'hamstrings'],
    equipment_id: 'equip-2',
    default_unit: 'kg',
    instructions: 'Descend until thighs are parallel to the floor, then stand back up.',
    is_active: true,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  },
]

export const mockPlans = [
  {
    id: 'plan-1',
    home_id: 'hh-1',
    owner_user_id: 'user-1',
    name: 'Push Pull Legs',
    description: 'A 3-day split focused on compound lifts.',
    is_shared: false,
    is_active: true,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
    days: [
      {
        id: 'day-1',
        day_order: 1,
        label: 'Push Day',
        exercises: [
          {
            id: 'plan-ex-1',
            exercise_id: 'ex-1',
            exercise_order: 1,
            sets: [
              {
                id: 'plan-set-1',
                set_order: 1,
                target_reps: 8,
                target_weight_type: 'default',
                target_weight_kg: null,
                offset_kg: null,
                is_warmup: false,
              },
            ],
          },
        ],
      },
    ],
  },
]

export const mockSession = {
  id: 'sess-1',
  home_id: 'hh-1',
  user_id: 'user-1',
  plan_id: 'plan-1',
  plan_day_label: 'Push Day',
  started_at: '2026-08-16T09:00:00Z',
  completed_at: null,
  status: 'active',
  notes: null,
  exercises: [
    {
      id: 'sess-ex-1',
      exercise_id: 'ex-1',
      exercise_name_snapshot: 'Bench Press',
      primary_muscle_snapshot: 'chest',
      exercise_order: 1,
      sets: [
        {
          id: 'sess-set-1',
          set_order: 1,
          target_reps: 8,
          target_weight_kg: 60,
          actual_reps: null,
          actual_weight_kg: null,
          is_warmup: false,
          completed_at: null,
          client_idempotency_key: null,
        },
      ],
    },
  ],
}

export const mockMuscleVolume = {
  from_date: null,
  to_date: null,
  entries: [{ primary_muscle: 'chest', total_volume_kg: 1200 }],
}

export const mockStreaks = {
  current_streak_days: 3,
  longest_streak_days: 7,
}

export const mockLeaderboard = {
  entries: [{ user_id: 'u-1', total_volume_kg: 1200, completed_session_count: 4 }],
}

export const mockExerciseFavorites = [mockExercises[0]]

export const mockExercisePreference = {
  id: 'pref-1',
  exercise_id: 'ex-1',
  default_target_weight_kg: 60,
  preferred_unit: 'kg',
  notes: null,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
}

export const handlers = [
  http.get(/\/equipment$/, () => {
    return HttpResponse.json(mockEquipment)
  }),

  http.post(/\/equipment$/, async ({ request }) => {
    const body = (await request.json()) as any
    return HttpResponse.json(
      {
        id: 'equip-new',
        scope: body.scope ?? 'household',
        home_id: body.scope === 'user' ? null : 'hh-1',
        owner_user_id: body.scope === 'user' ? 'user-1' : null,
        name: body.name,
        category: body.category ?? null,
        is_active: true,
        created_at: '2026-08-16T00:00:00Z',
        updated_at: '2026-08-16T00:00:00Z',
      },
      { status: 201 }
    )
  }),

  http.patch(/\/equipment\/([^\/]+)$/, async ({ params, request }) => {
    const id = params[0] as string
    const body = (await request.json()) as any
    const found = mockEquipment.find((entry) => entry.id === id) ?? mockEquipment[0]
    return HttpResponse.json({ ...found, ...body, id })
  }),

  http.delete(/\/equipment\/([^\/]+)$/, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Registered before the /exercises$ list handler is irrelevant here since the
  // regexes are disjoint, but the favorites/id handlers below are ordered to
  // mirror the backend, where /exercises/favorites is registered before /{id}.
  http.get(/\/exercises$/, ({ request }) => {
    const primaryMuscle = new URL(request.url).searchParams.get('primary_muscle')
    const filtered = primaryMuscle
      ? mockExercises.filter((exercise) => exercise.primary_muscle === primaryMuscle)
      : mockExercises
    return HttpResponse.json(filtered)
  }),

  http.post(/\/exercises$/, async ({ request }) => {
    const body = (await request.json()) as any
    return HttpResponse.json(
      {
        id: 'ex-new',
        scope: body.scope ?? 'household',
        home_id: 'hh-1',
        owner_user_id: null,
        name: body.name,
        primary_muscle: body.primary_muscle,
        secondary_muscles: body.secondary_muscles ?? null,
        equipment_id: body.equipment_id ?? null,
        default_unit: body.default_unit ?? 'kg',
        instructions: body.instructions ?? null,
        is_active: true,
        created_at: '2026-08-16T00:00:00Z',
        updated_at: '2026-08-16T00:00:00Z',
      },
      { status: 201 }
    )
  }),

  http.get(/\/exercises\/favorites$/, () => {
    return HttpResponse.json(mockExerciseFavorites)
  }),

  http.get(/\/exercises\/([^\/]+)\/preference$/, ({ params }) => {
    const id = params[0] as string
    if (id !== mockExercisePreference.exercise_id) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(mockExercisePreference)
  }),

  http.put(/\/exercises\/([^\/]+)\/preference$/, async ({ params, request }) => {
    const id = params[0] as string
    const body = (await request.json()) as any
    return HttpResponse.json({
      ...mockExercisePreference,
      id: 'pref-new',
      exercise_id: id,
      default_target_weight_kg: body.default_target_weight_kg ?? null,
      preferred_unit: body.preferred_unit ?? null,
      notes: body.notes ?? null,
    })
  }),

  http.post(/\/exercises\/([^\/]+)\/favorite$/, ({ params }) => {
    const id = params[0] as string
    return HttpResponse.json(
      { id: 'fav-new', exercise_id: id, created_at: '2026-08-16T00:00:00Z' },
      { status: 201 }
    )
  }),

  http.delete(/\/exercises\/([^\/]+)\/favorite$/, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(/\/exercises\/([^\/]+)$/, ({ params }) => {
    const id = params[0] as string
    const found = mockExercises.find((exercise) => exercise.id === id)
    if (!found) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(found)
  }),

  http.patch(/\/exercises\/([^\/]+)$/, async ({ params, request }) => {
    const id = params[0] as string
    const body = (await request.json()) as any
    const found = mockExercises.find((exercise) => exercise.id === id) ?? mockExercises[0]
    return HttpResponse.json({ ...found, ...body, id })
  }),

  http.delete(/\/exercises\/([^\/]+)$/, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(/\/plans$/, () => {
    return HttpResponse.json(mockPlans)
  }),

  http.get(/\/sessions$/, () => {
    return HttpResponse.json([])
  }),

  http.post(/\/sessions$/, () => {
    return HttpResponse.json(mockSession, { status: 201 })
  }),

  http.get(/\/analytics\/muscle-volume$/, () => {
    return HttpResponse.json(mockMuscleVolume)
  }),

  http.get(/\/analytics\/streaks$/, () => {
    return HttpResponse.json(mockStreaks)
  }),

  http.get(/\/analytics\/leaderboard$/, () => {
    return HttpResponse.json(mockLeaderboard)
  }),
]
