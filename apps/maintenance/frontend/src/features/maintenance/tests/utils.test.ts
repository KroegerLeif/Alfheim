import { describe, it, expect } from 'vitest'
import { collectDueAlerts, countSteps, getDeviceMaintenanceState, getNextServiceDate } from '../utils'
import { makeDevice, makeStep } from '../../../tests/fixtures'

const TODAY = new Date(2025, 5, 15, 12)

describe('countSteps', () => {
  it('counts steps per state and treats unscheduled steps as ok like the backend summary', () => {
    const devices = [
      makeDevice({
        steps: [
          makeStep({ supply_needed_date: '2025-06-14' }),
          makeStep({ supply_needed_date: '2025-06-29' }),
          makeStep({ supply_needed_date: '2025-06-30' }),
          makeStep({ supply_needed_date: null }),
        ],
      }),
      makeDevice({ steps: [] }),
    ]

    expect(countSteps(devices, TODAY)).toEqual({ total: 4, overdue: 1, dueSoon: 1, ok: 2 })
  })
})

describe('getDeviceMaintenanceState', () => {
  it('reports the worst state of the steps and ok for devices without steps', () => {
    expect(getDeviceMaintenanceState(makeDevice({ steps: [] }), TODAY)).toBe('ok')
    expect(getDeviceMaintenanceState(makeDevice({ steps: [makeStep({ supply_needed_date: null })] }), TODAY)).toBe('ok')
    const mixed = (...dates: string[]) =>
      makeDevice({ steps: dates.map((supply_needed_date) => makeStep({ supply_needed_date })) })
    expect(getDeviceMaintenanceState(mixed('2025-12-01', '2025-06-20'), TODAY)).toBe('due_soon')
    expect(getDeviceMaintenanceState(mixed('2025-12-01', '2025-06-14', '2025-06-20'), TODAY)).toBe('overdue')
  })
})

describe('getNextServiceDate', () => {
  it('returns the earliest due date and null when nothing is scheduled', () => {
    const device = makeDevice({
      steps: [
        makeStep({ supply_needed_date: '2025-09-01' }),
        makeStep({ supply_needed_date: null }),
        makeStep({ supply_needed_date: '2025-07-15' }),
      ],
    })
    expect(getNextServiceDate(device)).toBe('2025-07-15')
    expect(getNextServiceDate(makeDevice({ steps: [makeStep()] }))).toBeNull()
    expect(getNextServiceDate(makeDevice())).toBeNull()
  })
})

describe('collectDueAlerts', () => {
  it('lists overdue and due-soon steps with the most overdue first and skips ok and unscheduled steps', () => {
    const device = makeDevice({
      name: 'Boiler',
      steps: [
        makeStep({ title: 'Later', supply_needed_date: '2025-06-20' }),
        makeStep({ title: 'Far', supply_needed_date: '2026-01-01' }),
        makeStep({ title: 'Unplanned', supply_needed_date: null }),
        makeStep({ title: 'Very late', supply_needed_date: '2025-06-01' }),
        makeStep({ title: 'Today', supply_needed_date: '2025-06-15' }),
      ],
    })

    const alerts = collectDueAlerts([device], TODAY)

    expect(alerts.map((a) => [a.stepTitle, a.state, a.days])).toEqual([
      ['Very late', 'overdue', 14],
      ['Today', 'due_soon', 0],
      ['Later', 'due_soon', 5],
    ])
    expect(alerts.every((a) => a.deviceName === 'Boiler')).toBe(true)
    expect(new Set(alerts.map((a) => a.id)).size).toBe(3)
  })

  it('returns nothing without devices', () => {
    expect(collectDueAlerts([], TODAY)).toEqual([])
  })
})
