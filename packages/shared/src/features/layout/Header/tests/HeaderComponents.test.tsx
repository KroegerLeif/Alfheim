import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { AppHeader } from '../AppHeader'
import { AuthControls } from '../AuthControls'
import { AppShell } from '../../AppShell/AppShell'
import { LanguageProvider } from '../../../i18n/utils/LanguageContext'
import { ThemeProvider } from '../../../theme/hooks/ThemeContext'

describe('AppHeader Component', () => {
  it('passes accessibility audit', async () => {
    const { container } = render(
      <ThemeProvider>
        <LanguageProvider defaultLanguage="en">
          <AppHeader brandTitle="Pantry App" brandSubtitle="Inventory" appName="pantry" />
        </LanguageProvider>
      </ThemeProvider>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders title, subtitle, slots, and interactive controls', () => {
    render(
      <ThemeProvider>
        <LanguageProvider defaultLanguage="en">
          <AppHeader
            brandTitle="Pantry App"
            brandSubtitle="Inventory"
            leftSlot={<span data-testid="left-slot">Left</span>}
            centerSlot={<span data-testid="center-slot">Center</span>}
            actionsSlot={<span data-testid="actions-slot">Actions</span>}
          />
        </LanguageProvider>
      </ThemeProvider>
    )

    expect(screen.getByText('Pantry App')).toBeInTheDocument()
    expect(screen.getByText('Inventory')).toBeInTheDocument()
    expect(screen.getByTestId('left-slot')).toBeInTheDocument()
    expect(screen.getByTestId('center-slot')).toBeInTheDocument()
    expect(screen.getByTestId('actions-slot')).toBeInTheDocument()
  })

  it('renders minimal AppHeader with disabled optional controls', () => {
    render(
      <AppHeader
        showBackToDashboard={false}
        showHouseholdSwitcher={false}
        showLanguageSwitcher={false}
        showThemeToggle={false}
        showAuthControls={false}
        brandSubtitle=""
      />
    )
    expect(screen.getByText('Alfheim OS')).toBeInTheDocument()
  })
})

describe('AuthControls Component', () => {
  it('renders user initials avatar and triggers onLogout callback', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()

    render(
      <LanguageProvider defaultLanguage="en">
        <AuthControls user={{ name: 'John Doe', email: 'john@example.com' }} onLogout={onLogout} />
      </LanguageProvider>
    )

    expect(screen.getByText('JD')).toBeInTheDocument()
    const logoutBtn = screen.getByRole('button', { name: /logout/i })
    await user.click(logoutBtn)
    expect(onLogout).toHaveBeenCalled()
  })

  it('renders fallback when user is null', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <AuthControls user={null} />
      </LanguageProvider>
    )
    expect(screen.getByText('LK')).toBeInTheDocument()
  })
})

describe('AppShell Component', () => {
  it('renders header, main content, and mascot shell layout', () => {
    render(
      <AppShell header={<header>Header Content</header>}>
        <div>Main Page Content</div>
      </AppShell>
    )

    expect(screen.getByText('Header Content')).toBeInTheDocument()
    expect(screen.getByText('Main Page Content')).toBeInTheDocument()
  })
})
