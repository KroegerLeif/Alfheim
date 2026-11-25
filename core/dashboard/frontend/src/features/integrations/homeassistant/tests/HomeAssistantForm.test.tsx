import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnabledAppsCache } from '@alfheim/shared';
import { HomeAssistantForm } from '../components/HomeAssistantForm';
import { readSettings } from '../types';
import { haPlugin, renderAsAdmin, serveHomeAssistant } from './fixtures';
import { PLUGIN_FORMS } from '../../pluginForms';

describe('HomeAssistantForm', () => {
  beforeEach(() => resetEnabledAppsCache());

  it('saves address, token, pinned entities and allow_control when chat is installed', async () => {
    serveHomeAssistant();
    const onSubmit = vi.fn();
    renderAsAdmin(<HomeAssistantForm plugin={haPlugin} encryptionAvailable isSaving={false} onSubmit={onSubmit} />);

    const control = await screen.findByRole('checkbox', { name: /Let ALFI control devices/ });
    await userEvent.click(control);
    await userEvent.type(screen.getByLabelText('Long-lived access token'), 'tok');
    await userEvent.type(screen.getByLabelText('Entity id to pin'), 'light.kitchen{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Unpin sensor.temp' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(onSubmit).toHaveBeenCalledWith({
      enabled: true,
      base_url: 'http://ha.lan:8123',
      config: { pinned_entities: ['light.kitchen'], allow_control: true },
      credentials: { token: 'tok' },
    });
    expect(screen.getByLabelText('Long-lived access token')).toHaveValue('');
    expect(await screen.findByText('Rules')).toBeInTheDocument();
  });

  it('hides the chat-dependent control setting without chat and keeps the stored value', async () => {
    serveHomeAssistant({ apps: ['chores'] });
    const onSubmit = vi.fn();
    const plugin = { ...haPlugin, config: { pinned_entities: [], allow_control: true }, has_credentials: false };
    renderAsAdmin(<HomeAssistantForm plugin={plugin} encryptionAvailable={false} isSaving={false} onSubmit={onSubmit} />);

    await screen.findByText('Rules');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Long-lived access token')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(onSubmit).toHaveBeenCalledWith({
      enabled: true,
      base_url: 'http://ha.lan:8123',
      config: { pinned_entities: [], allow_control: true },
    });
  });

  it('validates pinned entities like the backend', async () => {
    serveHomeAssistant();
    renderAsAdmin(<HomeAssistantForm plugin={{ ...haPlugin, configured: false }} encryptionAvailable isSaving={false} onSubmit={vi.fn()} />);
    const input = screen.getByLabelText('Entity id to pin');
    await userEvent.type(input, 'Kitchen Light');
    await userEvent.click(screen.getByRole('button', { name: 'Pin' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Entity ids look like light.kitchen.');
    await userEvent.clear(input);
    await userEvent.type(input, 'sensor.temp{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('This entity is already pinned.');
    expect(screen.queryByText('Rules')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());
  });

  it('is registered for the homeassistant plugin type and reads settings defensively', () => {
    expect(PLUGIN_FORMS.homeassistant.Form).toBe(HomeAssistantForm);
    expect(readSettings(null)).toEqual({ pinned_entities: [], allow_control: false });
    expect(readSettings({ pinned_entities: ['a.b', 3], allow_control: 'yes' })).toEqual({ pinned_entities: ['a.b'], allow_control: false });
  });
});
