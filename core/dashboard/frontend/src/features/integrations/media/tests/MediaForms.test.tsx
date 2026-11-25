import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../tests/test-utils';
import { testPluginView } from '../../tests/fixtures';
import type { Plugin, PluginUpdate } from '../../types';
import { JellyfinForm, NavidromeForm } from '../forms';

const unconfigured: Plugin = { ...testPluginView, type: 'jellyfin', configured: false, enabled: false, base_url: '', has_credentials: false };

describe('media server forms', () => {
  it('enables a new Jellyfin plugin with its API key', async () => {
    const onSubmit = vi.fn<(u: PluginUpdate) => void>();
    renderWithProviders(<JellyfinForm plugin={unconfigured} encryptionAvailable isSaving={false} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Server address'), 'http://jellyfin.lan:8096');
    await userEvent.type(screen.getByLabelText('API key'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({
      enabled: true,
      base_url: 'http://jellyfin.lan:8096',
      config: {},
      credentials: { api_key: 'secret' },
    });
    expect(screen.getByLabelText('API key')).toHaveValue('');
  });

  it('keeps stored credentials when the inputs stay empty', async () => {
    const onSubmit = vi.fn<(u: PluginUpdate) => void>();
    const plugin = { ...testPluginView, type: 'navidrome', enabled: false, base_url: 'http://nd.lan:4533' };
    renderWithProviders(<NavidromeForm plugin={plugin} encryptionAvailable isSaving={false} onSubmit={onSubmit} />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('placeholder', 'Stored; leave empty to keep it');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({ enabled: false, base_url: 'http://nd.lan:4533', config: {} });
  });

  it('rejects a partial Navidrome login', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <NavidromeForm plugin={{ ...unconfigured, type: 'navidrome', base_url: 'http://nd' }} encryptionAvailable isSaving={false} onSubmit={onSubmit} />,
    );
    await userEvent.type(screen.getByLabelText('User name'), 'alice');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Fill in every credential field');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers no credential inputs without an encryption key', () => {
    renderWithProviders(<JellyfinForm plugin={unconfigured} encryptionAvailable={false} isSaving={false} onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
    expect(screen.getByText(/Media streams stay on your network/)).toBeInTheDocument();
  });
});
