import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { GoalDonutChart } from '../GoalDonutChart'
import { mockInstances } from '../../../../tests/mocks/handlers'

describe('GoalDonutChart Component', () => {
  it('breaks down chores by their real status, not a fabricated category derived from template_id (#502)', () => {
    // mockInstances has one "pending" and one "completed" instance. Previously the
    // chart derived a fake "category" from the first two characters of template_id
    // (which are just random UUID bytes); now it reflects a real, already-tracked field.
    render(<GoalDonutChart chores={mockInstances} />)

    expect(screen.getByText('pending')).toBeInTheDocument()
    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.queryByText('kitchen')).not.toBeInTheDocument()
    expect(screen.queryByText('livingRoom')).not.toBeInTheDocument()
  })

  it('shows the empty state when there are no chores', () => {
    render(<GoalDonutChart chores={[]} />)
    expect(screen.getByText('empty')).toBeInTheDocument()
  })
})
