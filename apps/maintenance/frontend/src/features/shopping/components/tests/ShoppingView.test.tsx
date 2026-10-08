import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { axe } from 'vitest-axe'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../tests/mocks/server'
import { renderWithProviders } from '../../../../tests/test-utils'
import { CART_STORAGE_KEY } from '../../hooks/useCart'
import { ShoppingView } from '../ShoppingView'

function seedCart(items: unknown) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
}

const storedCart = () => JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? 'null')

describe('ShoppingView cart', () => {
  it('shows the empty state for an empty cart', async () => {
    const { container } = renderWithProviders(<ShoppingView />)

    expect(screen.getByText('Your Cart is Empty')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send to Shopping App' })).not.toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('loads the persisted cart and shows each part once', async () => {
    seedCart(['HEPA Filter', 'Gasket', 'Gasket', 42])
    const { container } = renderWithProviders(<ShoppingView />)

    expect(await screen.findByText('HEPA Filter')).toBeInTheDocument()
    expect(screen.getAllByText('Gasket')).toHaveLength(1)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('recovers from an unreadable cart in storage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    localStorage.setItem(CART_STORAGE_KEY, '{not json')
    renderWithProviders(<ShoppingView />)

    expect(await screen.findByText('Your Cart is Empty')).toBeInTheDocument()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('removes a single part and persists the change', async () => {
    seedCart(['HEPA Filter', 'Gasket'])
    renderWithProviders(<ShoppingView />)

    fireEvent.click(await screen.findByRole('button', { name: 'Remove from cart: HEPA Filter' }))

    expect(screen.queryByText('HEPA Filter')).not.toBeInTheDocument()
    expect(storedCart()).toEqual(['Gasket'])
  })

  it('clears the whole cart', async () => {
    seedCart(['HEPA Filter', 'Gasket'])
    renderWithProviders(<ShoppingView />)

    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }))

    expect(screen.getByText('Your Cart is Empty')).toBeInTheDocument()
    expect(storedCart()).toEqual([])
  })

  it('wraps very long part names without pushing the remove button out', async () => {
    const longName = 'Replacement-gasket-for-the-primary-heat-exchanger-'.repeat(6)
    seedCart([longName])
    renderWithProviders(<ShoppingView />)

    const name = await screen.findByText(longName)
    expect(name).toHaveClass('break-words')
    expect(name).toHaveClass('min-w-0')
    expect(screen.getByRole('button', { name: `Remove from cart: ${longName}` })).toHaveClass('shrink-0')
  })

  it('renders in German', async () => {
    seedCart(['Filter'])
    renderWithProviders(<ShoppingView />, { locale: 'de' })

    expect(await screen.findByRole('button', { name: 'An Einkaufs-App senden' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CSV Export' })).toBeInTheDocument()
  })
})

describe('ShoppingView CSV export', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let blobs: Blob[]

  beforeEach(() => {
    blobs = []
    createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob)
      return 'blob:mock'
    })
    revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('exports the cart as a localized, escaped CSV file', async () => {
    seedCart(['Filter 3" x 5"', '=cmd'])
    renderWithProviders(<ShoppingView />, { locale: 'de' })

    fireEvent.click(await screen.findByRole('button', { name: 'CSV Export' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    const text = await blobs[0].text()
    expect(text).toBe(['"Ersatzteil","Status"', '"Filter 3"" x 5""","Benötigt"', '"\'=cmd","Benötigt"'].join('\n'))
  })
})

describe('ShoppingView send to shopping app', () => {
  it('sends the parts to the shopping API, empties the cart and confirms', async () => {
    const sent: string[] = []
    server.use(
      http.post('*/shopping/api/v1/shopping/items', async ({ request }) => {
        sent.push(((await request.json()) as { name: string }).name)
        return HttpResponse.json({ id: 'x' }, { status: 201 })
      })
    )
    seedCart(['HEPA Filter', 'Gasket'])
    renderWithProviders(<ShoppingView />)

    fireEvent.click(await screen.findByRole('button', { name: 'Send to Shopping App' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Sent to Shopping App!')
    expect(sent.sort()).toEqual(['Gasket', 'HEPA Filter'])
    expect(storedCart()).toEqual([])
    expect(screen.getByText('Your Cart is Empty')).toBeInTheDocument()
  })

  it('keeps only the rejected parts in the cart and says how many failed', async () => {
    server.use(
      http.post('*/shopping/api/v1/shopping/items', async ({ request }) => {
        const { name } = (await request.json()) as { name: string }
        return name === 'Gasket'
          ? HttpResponse.json({ detail: 'rejected' }, { status: 422 })
          : HttpResponse.json({ id: 'x' }, { status: 201 })
      })
    )
    seedCart(['HEPA Filter', 'Gasket'])
    renderWithProviders(<ShoppingView />)

    fireEvent.click(await screen.findByRole('button', { name: 'Send to Shopping App' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('1 of 2 items could not be sent and stay in your cart.')
    expect(storedCart()).toEqual(['Gasket'])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps the whole cart and shows an error when the shopping app is unreachable', async () => {
    server.use(http.post('*/shopping/api/v1/shopping/items', () => HttpResponse.error()))
    seedCart(['HEPA Filter'])
    renderWithProviders(<ShoppingView />)

    fireEvent.click(await screen.findByRole('button', { name: 'Send to Shopping App' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send the items to the shopping list.')
    expect(storedCart()).toEqual(['HEPA Filter'])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send to Shopping App' })).not.toBeDisabled())
  })

  it('disables the button and shows progress while sending', async () => {
    let release: () => void = () => undefined
    server.use(
      http.post('*/shopping/api/v1/shopping/items', async () => {
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return HttpResponse.json({ id: 'x' }, { status: 201 })
      })
    )
    seedCart(['HEPA Filter'])
    renderWithProviders(<ShoppingView />)

    fireEvent.click(await screen.findByRole('button', { name: 'Send to Shopping App' }))

    expect(await screen.findByRole('button', { name: 'Sending...' })).toBeDisabled()
    release()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})
