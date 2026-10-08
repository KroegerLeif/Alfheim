import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductCatalogView } from '../ProductCatalogView'
import { renderWithProviders } from '@/tests/utils'
import { json, mockApi } from '@/tests/mockApi'
import { API, category, product } from '@/tests/fixtures'

const apples = product({ id: '1', name: 'Apples', brand: 'Farmer', barcode: '111', category_id: 'cat1', is_global: true })
const milk = product({ id: '2', name: 'Milk', brand: 'Dairy', barcode: null, base_unit: 'ml', minimum_stock: 1000, category_id: 'cat2' })
const categories = [
  category({ id: 'cat1', name: 'Fruits', is_global: true }),
  category({ id: 'cat2', name: 'Dairy Products' }),
]

describe('ProductCatalogView', () => {
  afterEach(() => vi.unstubAllGlobals())

  function api(extra: Record<string, unknown> = {}) {
    return mockApi({
      [`GET ${API}/products`]: (call: { search: URLSearchParams }) =>
        call.search.get('name') ? [apples] : [apples, milk],
      [`GET ${API}/categories`]: categories,
      ...extra,
    })
  }

  it('renders the title, the product blueprints and their categories', async () => {
    api()
    renderWithProviders(<ProductCatalogView />)

    expect(screen.getByRole('heading', { name: 'Product Catalog' })).toBeInTheDocument()
    expect(await screen.findByText('Apples')).toBeInTheDocument()
    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getAllByText('Fruits').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Dairy Products').length).toBeGreaterThan(0)
  })

  it('searches the catalog on the server when a term is typed in', async () => {
    const mock = api()
    renderWithProviders(<ProductCatalogView />)
    await screen.findByText('Milk')

    fireEvent.change(screen.getByPlaceholderText('Search by name or barcode...'), { target: { value: 'Apples' } })

    expect(await screen.findByText('Apples')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Milk')).not.toBeInTheDocument())
    expect(mock.to(`GET ${API}/products`).some((c) => c.search.get('name') === 'Apples')).toBe(true)
  })

  it('offers edit and delete only for custom products, never for global templates', async () => {
    api()
    renderWithProviders(<ProductCatalogView />)
    await screen.findByText('Apples')

    expect(screen.queryByRole('button', { name: 'Edit product: Apples' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete product: Apples' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit product: Milk' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete product: Milk' })).toBeInTheDocument()
  })

  it('submits the create form with the entered values', async () => {
    const mock = api({ [`POST ${API}/products`]: () => json(201, product({ id: '3', name: 'Potatoes' })) })
    renderWithProviders(<ProductCatalogView />)
    await screen.findByText('Apples')

    fireEvent.change(screen.getByLabelText(/Product Name/), { target: { value: 'Potatoes' } })
    fireEvent.change(screen.getByLabelText('Brand (Optional)'), { target: { value: 'Local Farms' } })
    fireEvent.change(screen.getByLabelText(/Barcode \/ EAN/), { target: { value: '33333' } })
    fireEvent.change(screen.getByLabelText('Base Unit of Measurement'), { target: { value: 'g' } })
    fireEvent.change(screen.getByLabelText('Min Stock'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'cat1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }))

    await waitFor(() => expect(mock.to(`POST ${API}/products`)).toHaveLength(1))
    expect(mock.to(`POST ${API}/products`)[0].body).toEqual({
      name: 'Potatoes',
      brand: 'Local Farms',
      barcode: '33333',
      base_unit: 'g',
      minimum_stock: 500,
      category_id: 'cat1',
      nutrition: null,
    })
    expect(await screen.findByText('Product blueprint created successfully.')).toBeInTheDocument()
  })

  it('sends null for an omitted barcode', async () => {
    const mock = api({ [`POST ${API}/products`]: () => json(201, product({ id: '3', name: 'Onions' })) })
    renderWithProviders(<ProductCatalogView />)
    await screen.findByText('Apples')

    fireEvent.change(screen.getByLabelText(/Product Name/), { target: { value: 'Onions' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }))

    await waitFor(() => expect(mock.to(`POST ${API}/products`)).toHaveLength(1))
    expect(mock.to(`POST ${API}/products`)[0].body).toMatchObject({ name: 'Onions', barcode: null, brand: null })
  })

  it('shows the server reason and keeps the input when creating a product fails', async () => {
    api({ [`POST ${API}/products`]: () => json(400, { detail: "Product with barcode '33333' already exists." }) })
    renderWithProviders(<ProductCatalogView />)
    await screen.findByText('Apples')

    fireEvent.change(screen.getByLabelText(/Product Name/), { target: { value: 'Potatoes' } })
    fireEvent.change(screen.getByLabelText(/Barcode \/ EAN/), { target: { value: '33333' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Failed to create product blueprint.')
    expect(alert).toHaveTextContent("Product with barcode '33333' already exists.")
    expect(screen.getByLabelText(/Product Name/)).toHaveValue('Potatoes')
    expect(screen.getByLabelText(/Barcode \/ EAN/)).toHaveValue('33333')
  })

  it('shows the load error in the active language instead of English', async () => {
    mockApi({
      [`GET ${API}/products`]: () => json(403, { detail: 'nope' }),
      [`GET ${API}/categories`]: categories,
    })
    renderWithProviders(<ProductCatalogView />, { language: 'de' })

    expect(await screen.findByText('Der Produktkatalog konnte nicht geladen werden. Bitte versuche es später erneut.')).toBeInTheDocument()
  })

  it('edits a custom product through the dialog and sends only the editable fields', async () => {
    const mock = api({
      [`PATCH ${API}/products/2`]: () => json(200, { ...milk, name: 'Oat Milk', minimum_stock: 3 }),
    })
    renderWithProviders(<ProductCatalogView />)
    await screen.findByText('Milk')

    fireEvent.click(screen.getByRole('button', { name: 'Edit product: Milk' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Product Name/), { target: { value: 'Oat Milk' } })
    fireEvent.change(within(dialog).getByLabelText('Min Stock'), { target: { value: '3' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mock.to(`PATCH ${API}/products/2`)).toHaveLength(1))
    expect(mock.to(`PATCH ${API}/products/2`)[0].body).toEqual({
      name: 'Oat Milk',
      brand: 'Dairy',
      category_id: 'cat2',
      minimum_stock: 3,
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps the edit dialog open with the server reason when saving fails', async () => {
    api({ [`PATCH ${API}/products/2`]: () => json(400, { detail: 'Global products cannot be modified.' }) })
    renderWithProviders(<ProductCatalogView />)
    await screen.findByText('Milk')

    fireEvent.click(screen.getByRole('button', { name: 'Edit product: Milk' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Product Name/), { target: { value: 'Oat Milk' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Global products cannot be modified.')
    expect(within(dialog).getByLabelText(/Product Name/)).toHaveValue('Oat Milk')
  })

  it('asks for confirmation before deleting and removes the product afterwards', async () => {
    const mock = api({ [`DELETE ${API}/products/2`]: () => new Response(null, { status: 204 }) })
    renderWithProviders(<ProductCatalogView />)
    await screen.findByText('Milk')

    fireEvent.click(screen.getByRole('button', { name: 'Delete product: Milk' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete this product permanently?')).toBeInTheDocument()
    expect(mock.to(`DELETE ${API}/products/2`)).toHaveLength(0)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mock.to(`DELETE ${API}/products/2`)).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('explains a product_in_use conflict in the dialog and does not close it', async () => {
    api({
      [`DELETE ${API}/products/2`]: () =>
        json(409, { detail: { code: 'product_in_use', message: 'in use', item_count: 4 } }),
    })
    renderWithProviders(<ProductCatalogView />)
    await screen.findByText('Milk')

    fireEvent.click(screen.getByRole('button', { name: 'Delete product: Milk' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'This product still has stock or transaction history (4 records). It cannot be deleted.'
    )
  })
})
