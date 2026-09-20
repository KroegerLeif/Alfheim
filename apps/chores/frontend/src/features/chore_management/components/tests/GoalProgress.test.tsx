import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { GoalProgress } from '../GoalProgress'
import { mockTemplates, mockSummary } from '../../../../tests/mocks/handlers'

describe('GoalProgress Component', () => {
  it('computes potential points from each pending chore\'s real template points, not a flat multiplier (#515)', () => {
    // mockSummary has one pending instance (template "tpl-1", worth 15 points) and one
    // completed instance (template "tpl-2", worth 10 points). A flat "pending * 10"
    // would show 10; the real total for the one pending chore is 15.
    render(<GoalProgress summary={mockSummary} templates={mockTemplates} />)

    expect(screen.getByText((_, element) => element?.textContent === '15 potentialPts')).toBeInTheDocument()
  })

  it('sums points across multiple pending chores with different template values', () => {
    const summary = {
      ...mockSummary,
      today_pending_count: 2,
      today_chores: [
        { ...mockSummary.today_chores[0], status: 'pending' as const, template_id: 'tpl-1' },
        { ...mockSummary.today_chores[1], status: 'pending' as const, template_id: 'tpl-2' },
      ],
    }

    render(<GoalProgress summary={summary} templates={mockTemplates} />)

    // tpl-1 (15) + tpl-2 (10) = 25, not today_pending_count(2) * 10 = 20.
    expect(screen.getByText((_, element) => element?.textContent === '25 potentialPts')).toBeInTheDocument()
  })

  it('renders nothing when summary is not yet loaded', () => {
    const { container } = render(<GoalProgress summary={undefined} templates={mockTemplates} />)
    expect(container).toBeEmptyDOMElement()
  })
})
