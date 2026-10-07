import { describe, it, expect } from 'vitest'
import { groupDevicesByHousehold, OTHER_GROUP_ID } from '../utils'
import { makeDevice } from '../../../tests/fixtures'

describe('groupDevicesByHousehold', () => {
  const households = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
    { id: 'c', name: 'Empty' },
  ]

  it('keeps the household order, skips households without devices and collects strays last', () => {
    const devices = [
      makeDevice({ name: 'b1', household_id: 'b' }),
      makeDevice({ name: 'a1', household_id: 'a' }),
      makeDevice({ name: 'x1', household_id: 'x' }),
      makeDevice({ name: 'a2', household_id: 'a' }),
    ]

    const groups = groupDevicesByHousehold(devices, households, 'Other')

    expect(groups.map((g) => [g.id, g.name, g.devices.map((d) => d.name)])).toEqual([
      ['a', 'Alpha', ['a1', 'a2']],
      ['b', 'Beta', ['b1']],
      [OTHER_GROUP_ID, 'Other', ['x1']],
    ])
  })

  it('returns no groups when there are no devices', () => {
    expect(groupDevicesByHousehold([], households, 'Other')).toEqual([])
  })

  it('puts every device in the other group when no household is known', () => {
    const groups = groupDevicesByHousehold([makeDevice({ household_id: 'a' })], [], 'Other')
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe(OTHER_GROUP_ID)
  })
})
