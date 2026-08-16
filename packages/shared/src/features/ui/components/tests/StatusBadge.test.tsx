import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { axe } from 'vitest-axe'
import { StatusBadge } from '../StatusBadge'
import { LanguageProvider } from '../../../i18n/utils/LanguageContext'

describe('StatusBadge Component', () => {
  it('passes accessibility audit', async () => {
    const { container } = render(
      <LanguageProvider defaultLanguage="en">
        <StatusBadge status="active" />
      </LanguageProvider>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders active status with default emerald badge', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <StatusBadge status="active" />
      </LanguageProvider>
    )

    const badge = screen.getByText('Active')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('text-emerald-400')
  })

  it('renders in_progress status with amber badge', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <StatusBadge status="in_progress" />
      </LanguageProvider>
    )

    const badge = screen.getByText('In Progress')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('text-amber-400')
  })

  it('renders maintenance status with red badge', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <StatusBadge status="maintenance" />
      </LanguageProvider>
    )

    const badge = screen.getByText('Maintenance')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('text-red-400')
  })

  it('merges custom class names', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <StatusBadge status="active" className="custom-badge-class" />
      </LanguageProvider>
    )

    const badge = screen.getByText('Active')
    expect(badge.className).toContain('custom-badge-class')
  })
})
