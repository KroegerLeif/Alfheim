import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CategoryManager } from '../CategoryManager'
import { renderWithProviders } from '@/tests/utils'
import { json, mockApi } from '@/tests/mockApi'
import { API, category } from '@/tests/fixtures'

const categories = [
  category({ id: 'g1', name: 'Drinks', is_global: true }),
  category({ id: 'c1', name: 'Baking' }),
]

describe('CategoryManager', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists categories and only offers changes for custom ones', async () => {
    mockApi({ [`GET ${API}/categories`]: categories })
    renderWithProviders(<CategoryManager />)

    expect(await screen.findByText('Baking')).toBeInTheDocument()
    expect(screen.getByText('Drinks')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename category: Baking' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete category: Baking' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rename category: Drinks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete category: Drinks' })).not.toBeInTheDocument()
  })

  it('creates a category from the inline field and clears it', async () => {
    const mock = mockApi({
      [`GET ${API}/categories`]: categories,
      [`POST ${API}/categories`]: () => json(201, category({ id: 'c2', name: 'Spices' })),
    })
    renderWithProviders(<CategoryManager />)
    await screen.findByText('Baking')

    const field = screen.getByLabelText('Category Name')
    fireEvent.change(field, { target: { value: 'Spices' } })
    fireEvent.keyDown(field, { key: 'Enter' })

    await waitFor(() => expect(mock.to(`POST ${API}/categories`)).toHaveLength(1))
    expect(mock.to(`POST ${API}/categories`)[0].body).toEqual({ name: 'Spices' })
    await waitFor(() => expect(field).toHaveValue(''))
  })

  it('keeps the typed name and shows the server reason when creating fails', async () => {
    mockApi({
      [`GET ${API}/categories`]: categories,
      [`POST ${API}/categories`]: () => json(400, { detail: "Category with name 'Baking' already exists for this home." }),
    })
    renderWithProviders(<CategoryManager />)
    await screen.findByText('Baking')

    const field = screen.getByLabelText('Category Name')
    fireEvent.change(field, { target: { value: 'Baking' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Category with name 'Baking' already exists for this home.")
    expect(field).toHaveValue('Baking')
  })

  it('renames a category inline', async () => {
    const mock = mockApi({
      [`GET ${API}/categories`]: categories,
      [`PATCH ${API}/categories/c1`]: () => json(200, category({ id: 'c1', name: 'Bakery' })),
    })
    renderWithProviders(<CategoryManager />)
    await screen.findByText('Baking')

    fireEvent.click(screen.getByRole('button', { name: 'Rename category: Baking' }))
    const field = screen.getAllByLabelText('Category Name').find((el) => (el as HTMLInputElement).value === 'Baking')!
    fireEvent.change(field, { target: { value: 'Bakery' } })
    fireEvent.keyDown(field, { key: 'Enter' })

    await waitFor(() => expect(mock.to(`PATCH ${API}/categories/c1`)).toHaveLength(1))
    expect(mock.to(`PATCH ${API}/categories/c1`)[0].body).toEqual({ name: 'Bakery' })
  })

  it('deletes after confirmation', async () => {
    const mock = mockApi({
      [`GET ${API}/categories`]: categories,
      [`DELETE ${API}/categories/c1`]: () => new Response(null, { status: 204 }),
    })
    renderWithProviders(<CategoryManager />)
    await screen.findByText('Baking')

    fireEvent.click(screen.getByRole('button', { name: 'Delete category: Baking' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Baking')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mock.to(`DELETE ${API}/categories/c1`)).toHaveLength(1))
  })

  it('explains a category_in_use conflict with the product count, in German', async () => {
    mockApi({
      [`GET ${API}/categories`]: categories,
      [`DELETE ${API}/categories/c1`]: () =>
        json(409, { detail: { code: 'category_in_use', message: 'in use', item_count: 2 } }),
    })
    renderWithProviders(<CategoryManager />, { language: 'de' })
    await screen.findByText('Baking')

    fireEvent.click(screen.getByRole('button', { name: 'Kategorie löschen: Baking' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Diese Kategorie ist noch 2 Produkt(en) zugeordnet. Entferne sie zuerst aus diesen Produkten.'
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('keeps very long category names from stretching the row', async () => {
    const longName = 'Category-with-an-extremely-long-name-'.repeat(6)
    mockApi({ [`GET ${API}/categories`]: [category({ id: 'c9', name: longName })] })
    renderWithProviders(<CategoryManager />)

    const label = await screen.findByText(longName)
    expect(label).toHaveClass('truncate', 'min-w-0')
    expect(label).toHaveAttribute('title', longName)
  })
})
