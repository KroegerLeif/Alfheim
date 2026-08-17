import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Dialog, DialogContent, DialogTitle } from '../dialog'
import { LanguageProvider } from '@alfheim/shared'

describe('Dialog Primitive', () => {
  it('renders localized close button with screen-reader text', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Test Title</DialogTitle>
          <p>Dialog body content</p>
        </DialogContent>
      </Dialog>
    )

    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Dialog body content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'close' })).toBeInTheDocument()
  })
})
