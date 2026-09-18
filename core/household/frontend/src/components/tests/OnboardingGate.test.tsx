import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse, type JsonBodyType } from 'msw'
import { server } from '@/tests/mocks/server'
import { mockNavigation, mockRouter } from '@/tests/mocks/navigation'
import { renderWithProviders } from '@/tests/test-utils'
import { OnboardingGate } from '../OnboardingGate'
import { HOUSEHOLD_ONBOARDING_URL } from '@/lib/routes'

function mockHouseholdsResponse(body: JsonBodyType, status = 200) {
  server.use(http.get('*/api/v1/households/me', () => HttpResponse.json(body, { status })))
}

describe('OnboardingGate', () => {
  it('exports the public onboarding URL for other apps', () => {
    expect(HOUSEHOLD_ONBOARDING_URL).toBe('/household/onboarding')
  })

  it('redirects to /onboarding when the user has no household', async () => {
    mockHouseholdsResponse([])
    renderWithProviders(<OnboardingGate><p>content</p></OnboardingGate>)

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding'))
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('treats a null body as "no household"', async () => {
    mockHouseholdsResponse(null)
    renderWithProviders(<OnboardingGate><p>content</p></OnboardingGate>)
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding'))
  })

  it('does not redirect when the user has a household', async () => {
    mockHouseholdsResponse([{ id: 'hh-1', name: 'Home', slug: 'home', role: 'OWNER' }])
    renderWithProviders(<OnboardingGate><p>content</p></OnboardingGate>)

    // Give the query time to resolve before asserting the negative.
    await new Promise((r) => setTimeout(r, 50))
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it.each(['/join', '/onboarding', '/profile'])('does not redirect away from %s', async (path) => {
    mockHouseholdsResponse([])
    mockNavigation.pathname = path
    renderWithProviders(<OnboardingGate><p>content</p></OnboardingGate>)

    await new Promise((r) => setTimeout(r, 50))
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('does not redirect when the households request fails', async () => {
    mockHouseholdsResponse({ error: 'boom' }, 500)
    renderWithProviders(<OnboardingGate><p>content</p></OnboardingGate>)

    await new Promise((r) => setTimeout(r, 50))
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })
})
