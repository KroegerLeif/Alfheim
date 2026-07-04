import React from 'react'
import { render, screen } from '@testing-library/react'
import { Badge } from '../badge'

describe('Badge Primitive', () => {
  it('renders children content correctly', () => {
    render(<Badge>Low Stock</Badge>)
    const badgeElement = screen.getByText('Low Stock')
    expect(badgeElement).toBeInTheDocument()
  })

  it('supports alternative style variants', () => {
    render(<Badge variant="destructive">Critical</Badge>)
    const badgeElement = screen.getByText('Critical')
    expect(badgeElement).toHaveClass('bg-destructive')
  })

  it('passes additional html elements and classes', () => {
    render(<Badge className="font-mono">Mono Badge</Badge>)
    const badgeElement = screen.getByText('Mono Badge')
    expect(badgeElement).toHaveClass('font-mono')
  })
})
