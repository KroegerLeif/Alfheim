import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StockActionModal } from '../StockActionModal'
import { renderWithProviders } from '@/tests/utils'
import { json, mockApi } from '@/tests/mockApi'
import { API, category, location, product } from '@/tests/fixtures'

const apples = product({ id: 'p1', name: 'Apples', base_unit: 'piece' })
const backlog = location({ id: 'l1', name: 'Backlog', is_system: true })

function baseRoutes(extra: Record<string, unknown> = {}) {
  return {
    [`GET ${API}/locations`]: [backlog],
    [`GET ${API}/categories`]: [category({ id: 'c1', name: 'Fruits' })],
    ...extra,
  }
}

function openWithProduct(mode: 'in' | 'out' = 'out', language?: 'de' | 'pl' | 'en') {
  return renderWithProviders(<StockActionModal isOpen onClose={vi.fn()} mode={mode} preselectedProduct={apples} />, { language })
}

describe('StockActionModal transaction flow', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('records a transaction and closes the modal', async () => {
    const onClose = vi.fn()
    const mock = mockApi(baseRoutes({ [`POST ${API}/inventory/transactions`]: () => json(201, { id: 'tx1' }) }))
    renderWithProviders(<StockActionModal isOpen onClose={onClose} mode="in" preselectedProduct={apples} />)
    await waitFor(() => expect(screen.getByLabelText('Location')).toHaveValue('l1'))

    fireEvent.change(screen.getByLabelText('Transaction Quantity'.replace('Transaction ', '')), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'TRANSACTION: STOCK IN' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(mock.to(`POST ${API}/inventory/transactions`)[0].body).toMatchObject({
      product_id: 'p1', location_id: 'l1', transaction_type: 'in', quantity_input: 3, unit_input: 'piece',
    })
  })

  it('shows the server reason when stock would go negative and keeps every entered value', async () => {
    const onClose = vi.fn()
    mockApi(
      baseRoutes({
        [`POST ${API}/inventory/transactions`]: () =>
          json(400, { detail: "Insufficient stock for product 'Apples' in location 'Backlog'." }),
      })
    )
    renderWithProviders(<StockActionModal isOpen onClose={onClose} mode="out" preselectedProduct={apples} />)
    await waitFor(() => expect(screen.getByLabelText('Location')).toHaveValue('l1'))

    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Batch / Lot'), { target: { value: 'LOT-1' } })
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'party' } })
    fireEvent.click(screen.getByRole('button', { name: 'TRANSACTION: STOCK OUT' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The transaction could not be recorded.')
    expect(alert).toHaveTextContent("Insufficient stock for product 'Apples' in location 'Backlog'.")
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Quantity')).toHaveValue(9)
    expect(screen.getByLabelText('Batch / Lot')).toHaveValue('LOT-1')
    expect(screen.getByLabelText('Notes')).toHaveValue('party')
    expect(screen.getByRole('button', { name: 'TRANSACTION: STOCK OUT' })).toBeEnabled()
  })

  it('reports validation errors from the server, in German', async () => {
    mockApi(
      baseRoutes({
        [`POST ${API}/inventory/transactions`]: () =>
          json(422, { detail: [{ loc: ['body', 'unit_input'], msg: 'Value error, Unrecognized unit of measurement: x' }] }),
      })
    )
    openWithProduct('in', 'de')
    await waitFor(() => expect(screen.getByLabelText('Lagerort')).toHaveValue('l1'))

    fireEvent.click(screen.getByRole('button', { name: 'TRANSAKTION: WARENEINGANG' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Die Buchung konnte nicht erfasst werden.')
    expect(alert).toHaveTextContent('Unrecognized unit of measurement: x')
  })

  it('tells the user when the server cannot be reached', async () => {
    mockApi(
      baseRoutes({
        [`POST ${API}/inventory/transactions`]: () => {
          throw new TypeError('Failed to fetch')
        },
      })
    )
    openWithProduct('in')
    await waitFor(() => expect(screen.getByLabelText('Location')).toHaveValue('l1'))

    fireEvent.click(screen.getByRole('button', { name: 'TRANSACTION: STOCK IN' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The server could not be reached.')
  })

  it('keeps long product names inside the summary', async () => {
    const longName = 'Extra-long-product-name-without-spaces-'.repeat(6)
    mockApi(baseRoutes())
    renderWithProviders(
      <StockActionModal isOpen onClose={vi.fn()} mode="in" preselectedProduct={product({ id: 'p9', name: longName })} />
    )

    expect(await screen.findByText(longName)).toHaveClass('break-words')
  })
})

describe('StockActionModal inline creation', () => {
  afterEach(() => vi.unstubAllGlobals())

  async function openQuickProductForm(extra: Record<string, unknown> = {}) {
    const mock = mockApi(baseRoutes({ [`GET ${API}/products`]: [], ...extra }))
    renderWithProviders(<StockActionModal isOpen onClose={vi.fn()} mode="in" />)
    fireEvent.change(await screen.findByLabelText('Search product'), { target: { value: 'Pears' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Create New Product' }))
    return mock
  }

  it('shows the server reason and keeps the input when quick product creation fails', async () => {
    await openQuickProductForm({
      [`POST ${API}/products`]: () => json(400, { detail: "Product with barcode '1' already exists." }),
    })
    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText(/Barcode \/ EAN/), { target: { value: '1' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Product' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('Failed to create product blueprint.')
    expect(alert).toHaveTextContent("Product with barcode '1' already exists.")
    expect(within(dialog).getByLabelText(/Product Name/)).toHaveValue('Pears')
    expect(within(dialog).getByLabelText(/Barcode \/ EAN/)).toHaveValue('1')
  })

  it('creating a category inline does not submit the surrounding product form', async () => {
    const mock = await openQuickProductForm({
      [`POST ${API}/categories`]: () => json(201, category({ id: 'c2', name: 'Pome' })),
    })
    const dialog = screen.getByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: /Create New Category/ }))
    fireEvent.change(within(dialog).getByLabelText('Category Name'), { target: { value: 'Pome' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mock.to(`POST ${API}/categories`)).toHaveLength(1))
    expect(mock.to(`POST ${API}/categories`)[0].body).toEqual({ name: 'Pome' })
    expect(mock.to(`POST ${API}/products`)).toHaveLength(0)
  })

  it('shows the server reason and keeps the name when quick category creation fails', async () => {
    await openQuickProductForm({
      [`POST ${API}/categories`]: () => json(400, { detail: "Category with name 'Pome' already exists." }),
    })
    const dialog = screen.getByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: /Create New Category/ }))
    fireEvent.change(within(dialog).getByLabelText('Category Name'), { target: { value: 'Pome' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent("Category with name 'Pome' already exists.")
    expect(within(dialog).getByLabelText('Category Name')).toHaveValue('Pome')
  })

  it('says "no match" for an unknown barcode but reports other lookup failures as failures', async () => {
    mockApi(
      baseRoutes({
        [`GET ${API}/products/barcode/4001`]: () => json(404, { detail: 'not found' }),
        [`GET ${API}/products/barcode/4002`]: () => json(400, { detail: 'Open Food Facts is unavailable.' }),
      })
    )
    renderWithProviders(<StockActionModal isOpen onClose={vi.fn()} mode="in" />)
    const field = await screen.findByLabelText(/Barcode \/ EAN/)

    fireEvent.change(field, { target: { value: '4001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))
    expect(await screen.findByText('No matches found.')).toBeInTheDocument()

    fireEvent.change(field, { target: { value: '4002' } })
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))
    expect(await screen.findByText('The barcode lookup failed. Open Food Facts is unavailable.')).toBeInTheDocument()
  })
})
