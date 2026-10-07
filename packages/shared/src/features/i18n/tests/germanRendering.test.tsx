import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LanguageProvider } from '../utils/LanguageContext';
import { ThemeProvider } from '../../theme/hooks/ThemeContext';
import { AuthContext } from '../../auth/authContext';
import { Sidebar } from '../../layout/Sidebar/Sidebar';
import { ClientHeader } from '../../layout/ClientHeader/ClientHeader';
import { SidePanel } from '../../layout/SidePanel/SidePanel';
import { AuthControls } from '../../layout/Header/AuthControls';
import { Dialog, DialogContent, DialogTitle } from '../../ui/components/Dialog';
import { ErrorBoundary } from '../../ui/components/ErrorBoundary';
import { IconPicker } from '../../ui/components/IconPicker';
import { AppLogo } from '../../ui/components/AppLogo';
import { AlfheimLogo } from '../../ui/components/AlfheimLogo';
import { AlfiMascot } from '../../mascot/AlfiMascot';

/**
 * Visual i18n check (issue #579): shared components render real German copy from the
 * dictionaries, never raw keys or hardcoded English, when the active language is German.
 */
const de = (ui: React.ReactElement) => render(<LanguageProvider defaultLanguage="de">{ui}</LanguageProvider>);

function expectNoRawKeys(container: HTMLElement) {
  const text = container.textContent ?? '';
  expect(text).not.toMatch(/\b(common|header|household|auth|Chat)\.[a-z_]+/i);
}

function Boom(): React.ReactElement {
  throw new Error('');
}

describe('shared components in German', () => {
  it('Sidebar shows the translated app title and collapse controls', async () => {
    const onNavClick = vi.fn();
    const { container } = de(
      <Sidebar
        appName="pantry"
        activeHref="/a"
        onNavClick={onNavClick}
        navItems={[{ href: '/a', label: 'Bestand', icon: <span /> }]}
      />,
    );
    expect(screen.getByText('Digitale Vorratskammer')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Seitenleiste einklappen' }));
    expect(screen.getByRole('button', { name: 'Seitenleiste erweitern' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bestand' }));
    expect(onNavClick).toHaveBeenCalledWith('/a');
    expectNoRawKeys(container);
  });

  it('Sidebar falls back to the app name when no title key exists', () => {
    de(<Sidebar appName="unknownapp" activeHref="/" navItems={[{ href: '/', label: 'Start', icon: <span /> }]} />);
    expect(screen.getByText('UNKNOWNAPP')).toBeInTheDocument();
    expect(screen.queryByText('unknownapp.title')).not.toBeInTheDocument();
  });

  it('ClientHeader uses the translated subtitle and omits a missing one', () => {
    const auth = { user: null, token: null, isAuthenticated: true, isLoading: false, logout: vi.fn() };
    const { rerender } = render(
      <ThemeProvider>
        <LanguageProvider defaultLanguage="de">
          <AuthContext.Provider value={auth}>
            <ClientHeader appName="pantry" brandTitle="ALFHEIM // PANTRY" />
          </AuthContext.Provider>
        </LanguageProvider>
      </ThemeProvider>,
    );
    expect(screen.getByText('Bestand & Buchhaltung')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zurück zum Dashboard' })).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <LanguageProvider defaultLanguage="de">
          <AuthContext.Provider value={auth}>
            <ClientHeader appName="unknownapp" brandTitle="X" />
          </AuthContext.Provider>
        </LanguageProvider>
      </ThemeProvider>,
    );
    expect(screen.queryByText('header.brand_subtitles.unknownapp')).not.toBeInTheDocument();
  });

  it('SidePanel and AuthControls label their controls in German', () => {
    const { container } = de(
      <>
        <SidePanel isOpen title="Panel" onClose={vi.fn()}>
          body
        </SidePanel>
        <AuthControls user={{ name: 'Erika Mustermann' }} onLogout={vi.fn()} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument();
    expect(screen.getByText('EM')).toBeInTheDocument();
    expectNoRawKeys(container);
  });

  it('Dialog labels its close button in German', () => {
    de(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Titel</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
  });

  it('ErrorBoundary renders a translated fallback and retries rendering on click', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    de(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Etwas ist schiefgelaufen')).toBeInTheDocument();
    expect(
      screen.getByText('Beim Anzeigen dieses Bereichs ist ein unerwarteter Fehler aufgetreten.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(screen.getByText('Etwas ist schiefgelaufen')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('IconPicker shows and searches translated icon names', async () => {
    const onSelect = vi.fn();
    de(<IconPicker selectedIconId="apple" onSelectIcon={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Symbol wählen' }));
    const search = screen.getByRole('textbox', { name: 'Symbol suchen...' });
    await userEvent.type(search, 'Einkauf');
    await userEvent.click(screen.getByRole('button', { name: 'Einkaufstasche' }));
    expect(onSelect).toHaveBeenCalledWith('bag');

    await userEvent.click(screen.getByRole('button', { name: 'Symbol wählen' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Symbol suchen...' }), 'zzz');
    expect(screen.getByText('Keine Ergebnisse gefunden')).toBeInTheDocument();
  });

  it('AlfiMascot uses a translated accessible label', () => {
    de(<AlfiMascot state="thinking" />);
    expect(screen.getByLabelText('ALFI-Maskottchen (thinking)')).toBeInTheDocument();
  });
});

describe('shared icon assets', () => {
  it('AppLogo renders lucide glyphs for known apps and the brand mark otherwise', () => {
    const { container, rerender } = render(<AppLogo appName="Workout" variant="mark" />);
    expect(container.querySelector('svg.lucide')).toBeInTheDocument();
    rerender(<AppLogo appName="library" />);
    expect(container.querySelector('svg.lucide')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('AlfheimLogo renders the brand mark in mark, white and full variants', () => {
    const { container, rerender } = render(<AlfheimLogo variant="white" />);
    expect(container.querySelector('svg.text-white')).toBeInTheDocument();
    rerender(<AlfheimLogo variant="full" size={40} />);
    expect(screen.getByText('ALFHEIM')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('width', '26');
  });
});
