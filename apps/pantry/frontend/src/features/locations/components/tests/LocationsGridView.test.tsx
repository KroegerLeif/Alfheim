import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/tests/utils'
import { LocationsGridView } from '../LocationsGridView'

describe('LocationsGridView Feature Component', () => {
  it('renders locations grid and passes accessibility checks', async () => {
    const { container } = renderWithProviders(<LocationsGridView />)

    await waitFor(() => {
      expect(screen.getByText('Main Fridge')).toBeInTheDocument()
    })

    expect(screen.getByText('Kitchen primary refrigerator')).toBeInTheDocument()
    expect(screen.getByText('Pantry Shelf A')).toBeInTheDocument()

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('toggles location creation form and creates location', async () => {
    const { user } = renderWithProviders(<LocationsGridView />)

    await waitFor(() => {
      expect(screen.getByText('Main Fridge')).toBeInTheDocument()
    })

    const createToggleBtn = screen.getByRole('button', { name: 'createBtn' })
    await user.click(createToggleBtn)

    expect(screen.getByLabelText('name *')).toBeInTheDocument()

    await user.type(screen.getByLabelText('name *'), 'Freezer')
    await user.type(screen.getByLabelText('description'), 'Deep freezer in basement')

    const submitBtn = screen.getByRole('button', { name: 'submit' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Freezer')).toBeInTheDocument()
    })
  })

  it('renders empty locations state when no locations exist', async () => {
    server.use(
      http.get('*/api/v1/locations', () => {
        return HttpResponse.json([])
      })
    )

    renderWithProviders(<LocationsGridView />)

    await waitFor(() => {
      expect(screen.getByText('noLocations')).toBeInTheDocument()
    })
  })

  it('handles network error gracefully', async () => {
    server.use(
      http.get('*/api/v1/locations', () => {
        return new HttpResponse(null, { status: 500 })
      })
    )

    renderWithProviders(<LocationsGridView />)

    await waitFor(() => {
      expect(screen.getByText('noLocations')).toBeInTheDocument()
    })
  })
})
