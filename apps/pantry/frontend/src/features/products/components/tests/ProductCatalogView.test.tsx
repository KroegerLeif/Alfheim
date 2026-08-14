import React from 'react'
import { screen, waitFor, fireEvent, act } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/tests/utils'
import { ProductCatalogView } from '../ProductCatalogView'

describe('ProductCatalogView Feature Component', () => {
  it('renders products and passes accessibility checks', async () => {
    const { container } = renderWithProviders(<ProductCatalogView />)

    await waitFor(() => {
      expect(screen.getByText('Whole Milk')).toBeInTheDocument()
    })

    expect(screen.getByText('Basmati Rice')).toBeInTheDocument()
    expect(screen.getByText('Dairy')).toBeInTheDocument()
    expect(screen.getByText('Grains')).toBeInTheDocument()

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('filters product list using search input', async () => {
    renderWithProviders(<ProductCatalogView />)

    await waitFor(() => {
      expect(screen.getByText('Whole Milk')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('searchPlaceholder')
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Milk' } })
      await new Promise((resolve) => setTimeout(resolve, 350))
    })

    await waitFor(() => {
      expect(screen.getByText('Whole Milk')).toBeInTheDocument()
      expect(screen.queryByText('Basmati Rice')).not.toBeInTheDocument()
    })
  })

  it('creates a new product via creation form', async () => {
    const { user } = renderWithProviders(<ProductCatalogView />)

    await waitFor(() => {
      expect(screen.getByText('Whole Milk')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('name *'), 'Oat Milk')
    await user.type(screen.getByLabelText('brand'), 'Oatly')
    await user.type(screen.getByLabelText('barcode'), '555555')
    await user.selectOptions(screen.getByLabelText('category'), 'cat-1')

    const submitBtn = screen.getByRole('button', { name: 'submit' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Oat Milk')).toBeInTheDocument()
    })
  })

  it('renders empty list state when search yields no results', async () => {
    renderWithProviders(<ProductCatalogView />)

    await waitFor(() => {
      expect(screen.getByText('Whole Milk')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('searchPlaceholder')
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'UnknownProduct' } })
      await new Promise((resolve) => setTimeout(resolve, 350))
    })

    await waitFor(() => {
      expect(screen.getByText('noProducts')).toBeInTheDocument()
    })
  })

  it('handles backend network error gracefully', async () => {
    server.use(
      http.get('*/api/v1/products', () => {
        return new HttpResponse(null, { status: 500 })
      })
    )

    renderWithProviders(<ProductCatalogView />)

    await waitFor(() => {
      expect(screen.getByText('noProducts')).toBeInTheDocument()
    })
  })
})
