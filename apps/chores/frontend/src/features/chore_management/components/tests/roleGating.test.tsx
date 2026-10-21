import React from 'react'
import { screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { renderWithProviders } from '../../../../tests/test-utils'
import { mockTemplates, mockInstances } from '../../../../tests/mocks/handlers'
import { TaskCard } from '../TaskCard'
import { ChoresList } from '../ChoresList'
import { WizardView } from '../WizardView'

function renderBoard(role: string) {
  return renderWithProviders(
    <>
      <TaskCard template={mockTemplates[0]} />
      <ChoresList chores={[mockInstances[0]]} templates={mockTemplates} />
    </>,
    { role }
  )
}

describe('household role gating', () => {
  it('GUEST cannot delete templates, complete or claim chores, or open the creator', () => {
    renderBoard('GUEST')
    expect(screen.queryByRole('button', { name: 'Delete template' })).toBeNull()
    const complete = screen.getByRole('button', { name: 'Complete chore' })
    expect(complete).toBeDisabled()
    expect(complete.closest('[title]')).toHaveAttribute('title', expect.stringMatching(/Guests can view/))
    expect(screen.getByRole('button', { name: /assigned|claim/i })).toBeDisabled()
  })

  it('GUEST sees a hint instead of the task creator', () => {
    renderWithProviders(<WizardView />, { role: 'GUEST' })
    expect(screen.getByRole('note')).toHaveTextContent(/Guests can view/)
    expect(screen.queryByText('Chore Details')).toBeNull()
  })

  it('MEMBER can complete and claim but template delete is disabled with a hint', () => {
    renderBoard('MEMBER')
    expect(screen.getByRole('button', { name: 'Complete chore' })).toBeEnabled()
    const del = screen.getByRole('button', { name: 'Delete template' })
    expect(del).toBeDisabled()
    expect(del.closest('[data-testid="permission-hint"]')).toHaveAttribute(
      'title',
      expect.stringMatching(/admins and owners/)
    )
  })

  it('ADMIN can delete templates', () => {
    renderBoard('ADMIN')
    expect(screen.getByRole('button', { name: 'Delete template' })).toBeEnabled()
    expect(screen.queryByTestId('permission-hint')).toBeNull()
  })

  it('MEMBER sees the task creator', () => {
    renderWithProviders(<WizardView />, { role: 'MEMBER' })
    expect(screen.getByText('Chore Details')).toBeInTheDocument()
  })
})
