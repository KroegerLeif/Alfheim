import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { setTestLocale } from './locale';
import { PantryBadge } from '../components/shared/PantryBadge';
import { GlassCheckbox } from '../features/shopping-lists/components/GlassCheckbox';

describe('Component Smoke Tests', () => {
  describe('PantryBadge Component', () => {
    it('renders correctly with pantry label', () => {
      render(<PantryBadge />);
      expect(screen.getByText('Pantry')).toBeInTheDocument();
    });
  });

  describe('GlassCheckbox Component', () => {
    it('renders checked state correctly and triggers onChange when clicked', () => {
      const handleChange = vi.fn();
      render(<GlassCheckbox checked={true} onChange={handleChange} />);

      const button = screen.getByRole('button', { name: 'Mark as unchecked' });
      expect(button).toBeInTheDocument();

      fireEvent.click(button);
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('labels the button in the active locale', () => {
      setTestLocale('de');
      render(<GlassCheckbox checked={false} onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Als erledigt markieren' })).toBeInTheDocument();
    });

    it('renders unchecked state and handles disabled attribute', () => {
      const handleChange = vi.fn();
      render(<GlassCheckbox checked={false} onChange={handleChange} disabled={true} />);

      const button = screen.getByRole('button', { name: 'Mark as checked' });
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(handleChange).not.toHaveBeenCalled();
    });
  });
});
