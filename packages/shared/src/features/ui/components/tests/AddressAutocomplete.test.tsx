import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { axe } from 'vitest-axe'
import { AddressAutocomplete } from '../AddressAutocomplete'

describe('AddressAutocomplete Component', () => {
  const mockOnSelect = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    mockOnSelect.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('passes accessibility audit', async () => {
    vi.useRealTimers()
    const { container } = render(
      <AddressAutocomplete placeholder="Type address" onSelect={mockOnSelect} />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('fetches address suggestions from Nominatim API after debounce delay', async () => {
    vi.useRealTimers()
    const mockResults = [
      {
        display_name: '123 Main St, Berlin, Germany',
        lat: '52.5200',
        lon: '13.4050',
        address: {
          road: 'Main St',
          house_number: '123',
          postcode: '10115',
          city: 'Berlin',
          country: 'Germany',
        },
      },
    ]

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResults,
    } as Response)

    const user = userEvent.setup()
    render(<AddressAutocomplete placeholder="Type address" onSelect={mockOnSelect} />)

    const input = screen.getByPlaceholderText('Type address')
    await user.type(input, 'Berlin')

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('nominatim.openstreetmap.org/search?format=json&q=Berlin'),
        expect.any(Object)
      )
      expect(screen.getByText('123 Main St, Berlin, Germany')).toBeInTheDocument()
    })

    await user.click(screen.getByText('123 Main St, Berlin, Germany'))
    expect(mockOnSelect).toHaveBeenCalledWith({
      display_name: '123 Main St, Berlin, Germany',
      street: 'Main St 123',
      zip: '10115',
      city: 'Berlin',
      country: 'Germany',
      lat: 52.52,
      lng: 13.405,
    })
  })

  it('closes dropdown when clicking outside', async () => {
    vi.useRealTimers()
    render(
      <div>
        <AddressAutocomplete initialValue="Test Query" onSelect={mockOnSelect} />
        <button type="button">Outside Button</button>
      </div>
    )

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('handles geocoding fetch errors gracefully', async () => {
    vi.useRealTimers()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const user = userEvent.setup()
    render(<AddressAutocomplete placeholder="Type address" onSelect={mockOnSelect} />)

    const input = screen.getByPlaceholderText('Type address')
    await user.type(input, 'Failed City')

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Nominatim autocomplete geocoding failure:',
        expect.any(Error)
      )
    })
  })
})
