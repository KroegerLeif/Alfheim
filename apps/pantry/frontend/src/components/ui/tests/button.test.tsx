import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../button'

describe('Button Primitive', () => {
  it('renders correctly with standard children text', () => {
    render(<Button>Click Me</Button>)
    const buttonElement = screen.getByText('Click Me')
    expect(buttonElement).toBeInTheDocument()
    expect(buttonElement.tagName).toBe('BUTTON')
  })

  it('triggers onClick handler when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click Me</Button>)
    const buttonElement = screen.getByText('Click Me')

    fireEvent.click(buttonElement)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('respects disabled state attributes', () => {
    render(<Button disabled>Disabled Button</Button>)
    const buttonElement = screen.getByRole('button', { name: 'Disabled Button' })
    expect(buttonElement).toBeDisabled()
  })

  it('applies custom className values', () => {
    render(<Button className="swiss-custom-class">Swiss Style</Button>)
    const buttonElement = screen.getByText('Swiss Style')
    expect(buttonElement).toHaveClass('swiss-custom-class')
  })
})
