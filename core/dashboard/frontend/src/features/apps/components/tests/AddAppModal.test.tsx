import React from 'react'
import { screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { renderWithProviders } from '../../../../tests/test-utils'
import { AddAppModal } from '../AddAppModal'

describe('AddAppModal Component', () => {
  it('passes accessibility audit when open', async () => {
    const { container } = renderWithProviders(
      <AddAppModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders modal title and form elements when open', () => {
    renderWithProviders(
      <AddAppModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
    )
    expect(screen.getByText('add_user_link_title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('link_title_placeholder')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('target_url_placeholder')).toBeInTheDocument()
  })
})
