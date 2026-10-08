import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '../Button'

describe('Button type', () => {
  it('defaults to type="button" so helper buttons do not submit a form', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Button>Add row</Button>
      </form>,
    )
    const button = screen.getByRole('button', { name: 'Add row' })
    expect(button).toHaveAttribute('type', 'button')
    fireEvent.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the form when type="submit" is passed', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Save</Button>
      </form>,
    )
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveAttribute('type', 'submit')
    fireEvent.click(button)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('keeps type="reset" when passed explicitly', () => {
    render(<Button type="reset">Clear</Button>)
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveAttribute('type', 'reset')
  })

  it('adds no default type to an asChild element', () => {
    render(
      <Button asChild>
        <a href="/plans">Plans</a>
      </Button>,
    )
    expect(screen.getByRole('link', { name: 'Plans' })).not.toHaveAttribute('type')
  })
})
