import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { StaticHouseholdProvider } from '@alfheim/shared';
import { server } from '../../../../tests/mocks/server';
import { renderWithProviders } from '../../../../tests/test-utils';
import { LauncherForm } from '../LauncherForm';
import type { Launcher } from '../../types';

function renderForm(props: { launcher?: Launcher; onDone?: () => void } = {}) {
  const onDone = props.onDone ?? vi.fn();
  renderWithProviders(
    <StaticHouseholdProvider householdId="hh-a" value={{ role: 'ADMIN' }}>
      <LauncherForm launcher={props.launcher} onDone={onDone} />
    </StaticHouseholdProvider>,
  );
  return onDone;
}

describe('LauncherForm', () => {
  it('prefills title and icon from a preset and posts the launcher without a household id', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post('*api/v1/launchers', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...body, id: 'l-new' }, { status: 201 });
      }),
    );
    const onDone = renderForm();

    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'jellyfin');
    expect(screen.getByLabelText('Title')).toHaveValue('Jellyfin');
    expect(screen.getByLabelText('Icon')).toHaveValue('clapperboard');

    await userEvent.type(screen.getByLabelText('Address (URL)'), 'https://jellyfin.home.example:8096');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(body).toEqual({
      title: 'Jellyfin',
      url: 'https://jellyfin.home.example:8096',
      icon: 'clapperboard',
      description: '',
      display_order: 0,
    });
  });

  it('keeps a typed title when the custom preset is chosen', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Title'), 'Wiki');
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'youtube');
    expect(screen.getByLabelText('Title')).toHaveValue('YouTube');
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'custom');
    expect(screen.getByLabelText('Title')).toHaveValue('YouTube');
    expect(screen.getByLabelText('Icon')).toHaveValue('link');
  });

  it('shows the validation message when the backend rejects the URL', async () => {
    server.use(
      http.post('*api/v1/launchers', () =>
        HttpResponse.json({ detail: { code: 'validation_error', message: 'invalid', errors: [] } }, { status: 422 }),
      ),
    );
    const onDone = renderForm();
    await userEvent.type(screen.getByLabelText('Title'), 'Bad');
    await userEvent.type(screen.getByLabelText('Address (URL)'), 'https://user:pass@a.example');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('must not contain a user name or password');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('explains a role rejection and other failures', async () => {
    server.use(http.post('*api/v1/launchers', () => HttpResponse.json({ detail: { code: 'household_role_forbidden' } }, { status: 403 })));
    renderForm();
    await userEvent.type(screen.getByLabelText('Title'), 'X');
    await userEvent.type(screen.getByLabelText('Address (URL)'), 'https://a.example');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only household owners and admins');

    server.use(http.post('*api/v1/launchers', () => HttpResponse.json({}, { status: 500 })));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not be saved'));
  });

  it('updates an existing launcher with PUT', async () => {
    let path = '';
    let body: Record<string, unknown> = {};
    server.use(
      http.put('*api/v1/launchers/:id', async ({ request, params }) => {
        path = String(params.id);
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...body, id: params.id });
      }),
    );
    const launcher: Launcher = {
      id: 'l-7', title: 'HA', url: 'http://ha.lan:8123', icon: 'house', description: '', display_order: 3,
      created_at: '2026-11-23T00:00:00Z', updated_at: '2026-11-23T00:00:00Z',
    };
    const onDone = renderForm({ launcher });

    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'Home Assistant');
    await userEvent.selectOptions(screen.getByLabelText('Icon'), 'lightbulb');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(path).toBe('l-7');
    expect(body).toMatchObject({ title: 'Home Assistant', icon: 'lightbulb', display_order: 3 });
  });
});
