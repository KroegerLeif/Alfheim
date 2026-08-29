import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useTranslation } from '../useTranslation'
import { LanguageProvider } from '../LanguageContext'
import { Language } from '../types'

describe('useTranslation Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    document.cookie = 'NEXT_LOCALE=; path=/; max-age=0'
  })

  it('defaults to German language and translates common and budget keys', () => {
    const { result } = renderHook(() => useTranslation())

    expect(result.current.language).toBe('de')
    expect(result.current.t('common.active')).toBe('Aktiv')
    expect(result.current.t('common.save')).toBe('Speichern')
    expect(result.current.t('common.close')).toBe('Schließen')
    expect(result.current.t('maintenance.history.load_error')).toBe('Wartungsverlauf konnte nicht geladen werden. Bitte versuchen Sie es erneut.')
    expect(result.current.t('auth.error')).toBe('Authentifizierungsfehler')
    expect(result.current.t('auth.securing_session')).toBe('Sitzung mit Keycloak wird gesichert...')
    expect(result.current.t('dashboard.contact.categories.business')).toBe('Unternehmen')
    expect(result.current.t('dashboard.household.roles.member')).toBe('MITGLIED')
    expect(result.current.t('budget.title')).toBe('Budget & Finanzen')
    expect(result.current.t('budget.accounts.checking')).toBe('Girokonto')
    expect(result.current.t('budget.pots.sinkingFund')).toBe('Ansparziel-Rechner')
  })

  it('translates keys in English when language is set to en', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LanguageProvider defaultLanguage="en">{children}</LanguageProvider>
    )
    const { result } = renderHook(() => useTranslation(), { wrapper })

    expect(result.current.language).toBe('en')
    expect(result.current.t('common.active')).toBe('Active')
    expect(result.current.t('common.save')).toBe('Save')
    expect(result.current.t('common.close')).toBe('Close')
    expect(result.current.t('maintenance.history.load_error')).toBe('Failed to load service history. Please try again.')
    expect(result.current.t('auth.error')).toBe('Authentication Error')
    expect(result.current.t('auth.securing_session')).toBe('Securing session with Keycloak...')
    expect(result.current.t('dashboard.contact.categories.business')).toBe('Business')
    expect(result.current.t('dashboard.household.roles.member')).toBe('MEMBER')
    expect(result.current.t('budget.title')).toBe('Budget & Treasury')
    expect(result.current.t('budget.accounts.checking')).toBe('Checking Account')
    expect(result.current.t('budget.pots.sinkingFund')).toBe('Sinking Fund Calculator')
  })

  it('translates keys in Polish when language is set to pl', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LanguageProvider defaultLanguage="pl">{children}</LanguageProvider>
    )
    const { result } = renderHook(() => useTranslation(), { wrapper })

    expect(result.current.language).toBe('pl')
    expect(result.current.t('common.active')).toBe('Aktywny')
    expect(result.current.t('common.save')).toBe('Zapisz')
    expect(result.current.t('common.close')).toBe('Zamknij')
    expect(result.current.t('maintenance.history.load_error')).toBe('Nie udało się załadować historii serwisowej. Spróbuj ponownie.')
    expect(result.current.t('auth.error')).toBe('Błąd uwierzytelniania')
    expect(result.current.t('auth.securing_session')).toBe('Zabezpieczanie sesji z Keycloak...')
    expect(result.current.t('dashboard.contact.categories.business')).toBe('Firma')
    expect(result.current.t('dashboard.household.roles.member')).toBe('CZŁONEK')
    expect(result.current.t('budget.title')).toBe('Budżet i Skarbiec')
    expect(result.current.t('budget.accounts.checking')).toBe('Konto Osobiste')
    expect(result.current.t('budget.pots.sinkingFund')).toBe('Kalkulator Funduszu Celowego')
  })

  it('interpolates dynamic parameters into translated messages', () => {
    const { result } = renderHook(() => useTranslation())

    // Direct interpolation test with dummy or existing parameterized string
    const interpolated = result.current.t('common.nonexistent_with_param_{name}', { name: 'Alfheim' })
    expect(interpolated).toBe('common.nonexistent_with_param_Alfheim')
  })

  it('falls back to raw key if key does not exist in any dictionary', () => {
    const { result } = renderHook(() => useTranslation())
    expect(result.current.t('completely.unknown.nested.key')).toBe('completely.unknown.nested.key')
  })

  it('allows dynamic language switching and persists in localStorage and cookies', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LanguageProvider defaultLanguage="de">{children}</LanguageProvider>
    )
    const { result } = renderHook(() => useTranslation(), { wrapper })

    expect(result.current.language).toBe('de')
    expect(result.current.t('common.active')).toBe('Aktiv')

    act(() => {
      result.current.setLanguage('en')
    })

    expect(result.current.language).toBe('en')
    expect(result.current.t('common.active')).toBe('Active')
    expect(localStorage.getItem('alfheim_language')).toBe('en')
    expect(document.cookie).toContain('NEXT_LOCALE=en')
  })
})
