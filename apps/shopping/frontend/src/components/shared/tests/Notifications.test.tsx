import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { NotificationsProvider, useNotifications } from '../Notifications'
import { setTestLocale } from '@/tests/locale'

function Trigger({ message }: { message: string }) {
  const { notifyError } = useNotifications()
  return (
    <button type="button" onClick={() => notifyError(message)}>
      fire
    </button>
  )
}

describe('NotificationsProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows an error as an alert and lets the user dismiss it', () => {
    render(
      <NotificationsProvider>
        <Trigger message="Could not add the item." />
      </NotificationsProvider>
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('fire'))
    expect(screen.getByRole('alert')).toHaveTextContent('Could not add the item.')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('removes a message after the timeout', () => {
    vi.useFakeTimers()
    render(
      <NotificationsProvider dismissAfterMs={1000}>
        <Trigger message="Gone soon" />
      </NotificationsProvider>
    )
    fireEvent.click(screen.getByText('fire'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1001)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not stack identical messages and keeps long text inside the box', () => {
    const long = 'Something failed '.repeat(40)
    render(
      <NotificationsProvider>
        <Trigger message={long} />
      </NotificationsProvider>
    )
    fireEvent.click(screen.getByText('fire'))
    fireEvent.click(screen.getByText('fire'))

    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0].querySelector('span')).toHaveClass('break-words', 'min-w-0')
  })

  it('localizes the dismiss button', () => {
    setTestLocale('pl')
    render(
      <NotificationsProvider>
        <Trigger message="x" />
      </NotificationsProvider>
    )
    fireEvent.click(screen.getByText('fire'))
    expect(screen.getByRole('button', { name: 'Zamknij komunikat' })).toBeInTheDocument()
  })

  it('refuses to be used without a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Trigger message="x" />)).toThrow('NotificationsProvider')
    spy.mockRestore()
  })
})
