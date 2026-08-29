import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PantryChatProvider, usePantryChat } from '../chatContext';
import { ClientHeader } from '@/components/shared/ClientHeader';
import { PantryChatOverlay } from '@/components/shared/PantryChatOverlay';
import { ProductList } from '@/features/products/components/ProductList';
import { InventoryTableRow } from '@/features/inventory/components/InventoryTableRow';
import { LanguageProvider, ThemeProvider } from '@alfheim/shared';

describe('Pantry ALFI Chat Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  const renderWithProviders = (ui: React.ReactNode) => {
    return render(
      <LanguageProvider defaultLanguage="de">
        <ThemeProvider defaultMode="dark" defaultVariant="obsidian">
          <PantryChatProvider>
            {ui}
            <PantryChatOverlay />
          </PantryChatProvider>
        </ThemeProvider>
      </LanguageProvider>
    );
  };

  it('renders ALFI chat trigger in ClientHeader and toggles widget', () => {
    renderWithProviders(<ClientHeader />);

    const alfiBtn = screen.getByRole('button', { name: /ALFI/i });
    expect(alfiBtn).toBeInTheDocument();

    // Widget should initially be closed
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

    // Click to open widget
    fireEvent.click(alfiBtn);
    const sidePanel = screen.getByRole('complementary');
    expect(sidePanel).toBeInTheDocument();
    expect(within(sidePanel).getByText('pantry')).toBeInTheDocument();
  });

  it('provides householdId from localStorage to ChatContext', () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-test-456');

    function TestConsumer() {
      const { householdId } = usePantryChat();
      return <div data-testid="hh-val">{householdId}</div>;
    }

    renderWithProviders(<TestConsumer />);
    expect(screen.getByTestId('hh-val').textContent).toBe('hh-test-456');
  });

  it('opens ChatWidget with contextual product data when clicked from ProductList', () => {
    const mockProducts = [
      {
        id: 'prod-101',
        name: 'Hafermilch Barista',
        brand: 'Oatly',
        barcode: '7394376616037',
        base_unit: 'ml',
        minimum_stock: 2000,
        category_id: 'cat-1',
        is_global: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    renderWithProviders(
      <ProductList products={mockProducts as any} categories={[]} isLoading={false} />
    );

    const askAlfiBtn = screen.getByRole('button', { name: /ALFI Assistent: Hafermilch Barista/i });
    fireEvent.click(askAlfiBtn);

    const sidePanel = screen.getByRole('complementary');
    expect(sidePanel).toBeInTheDocument();
    expect(within(sidePanel).getByText('pantry')).toBeInTheDocument();
  });

  it('opens ChatWidget with contextual product data when clicked from InventoryTableRow', () => {
    const mockState = {
      id: 'inv-1',
      product_id: 'prod-101',
      location_id: 'loc-1',
      quantity: 3.0,
      expiration_date: '2026-12-31',
      product: {
        id: 'prod-101',
        name: 'Hafermilch Barista',
        brand: 'Oatly',
        barcode: '7394376616037',
        base_unit: 'ml',
        minimum_stock: 2000,
      },
      location: {
        id: 'loc-1',
        name: 'Kühlschrank',
      },
    };

    renderWithProviders(
      <table>
        <tbody>
          <InventoryTableRow state={mockState as any} onQuickAction={vi.fn()} />
        </tbody>
      </table>
    );

    const askAlfiBtn = screen.getByRole('button', { name: /ALFI Assistent: Hafermilch Barista/i });
    fireEvent.click(askAlfiBtn);

    const sidePanel = screen.getByRole('complementary');
    expect(sidePanel).toBeInTheDocument();
    expect(within(sidePanel).getByText('pantry')).toBeInTheDocument();
  });
});
