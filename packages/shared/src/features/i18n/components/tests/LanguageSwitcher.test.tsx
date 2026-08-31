import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { LanguageProvider } from '../../utils/LanguageContext'

vi.mock('next/navigation', () => ({
  usePathname: () => '/de/dashboard',
  useRouter: () => ({
    replace: vi.fn(),
  }),
}))

describe('LanguageSwitcher Component', () => {
  it('passes accessibility audit', async () => {
    const { container } = render(
      <LanguageProvider defaultLanguage="en">
        <LanguageSwitcher variant="dropdown" />
      </LanguageProvider>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders dropdown variant and switches language', async () => {
    const user = userEvent.setup()
    render(
      <LanguageProvider defaultLanguage="en">
        <LanguageSwitcher variant="dropdown" />
      </LanguageProvider>
    )

    const toggle = screen.getByRole('button', { name: /select language/i })
    await user.click(toggle)

    const deutschBtn = screen.getByRole('button', { name: /deutsch/i })
    await user.click(deutschBtn)
  })

  it('renders buttons variant and switches language', async () => {
    const user = userEvent.setup()
    render(
      <LanguageProvider defaultLanguage="en">
        <LanguageSwitcher variant="buttons" />
      </LanguageProvider>
    )

    const plBtn = screen.getByRole('button', { name: /pl/i })
    await user.click(plBtn)
  })
})
