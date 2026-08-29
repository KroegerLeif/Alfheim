import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { AlfiMascot } from '../AlfiMascot';
import { AlfiAvatar } from '../AlfiAvatar';
import { useAlfiChatLifecycle } from '../useAlfiChatLifecycle';
import { renderHook } from '@testing-library/react';

describe('AlfiMascot Component', () => {
  it('renders idle state by default with proper data attributes and aria label', () => {
    render(<AlfiMascot />);
    const mascot = screen.getByTestId('alfi-mascot');
    expect(mascot).toBeInTheDocument();
    expect(mascot).toHaveAttribute('data-state', 'idle');
    expect(mascot).toHaveAttribute('data-asset', 'alfi/alfi-idle.svg');
    expect(mascot).toHaveAttribute('aria-label', 'ALFI (idle)');
  });

  it('renders specific mascot states (thinking, speaking, listening, eating, fixing, chasing, sleeping)', () => {
    const { rerender } = render(<AlfiMascot state="thinking" />);
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-state', 'thinking');
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-asset', 'alfi/alfi-thinking.svg');

    rerender(<AlfiMascot state="speaking" />);
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-state', 'speaking');
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-asset', 'alfi/alfi-speaking.svg');

    rerender(<AlfiMascot state="listening" />);
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-state', 'listening');
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-asset', 'alfi/alfi-listening.svg');

    rerender(<AlfiMascot state="eating" />);
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-state', 'eating');
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-asset', 'alfi/alfi-eating.svg');

    rerender(<AlfiMascot state="fixing" />);
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-state', 'fixing');
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-asset', 'alfi/alfi-fixing.svg');

    rerender(<AlfiMascot state="chasing" />);
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-state', 'chasing');
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-asset', 'alfi/alfi-chasing.svg');

    rerender(<AlfiMascot state="sleeping" />);
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-state', 'sleeping');
    expect(screen.getByTestId('alfi-mascot')).toHaveAttribute('data-asset', 'alfi/alfi-sleeping.svg');
  });

  it('falls back safely to idle asset when given an unknown state string', () => {
    render(<AlfiMascot state={"unregistered_state" as any} />);
    const mascot = screen.getByTestId('alfi-mascot');
    expect(mascot).toHaveAttribute('data-state', 'unregistered_state');
    expect(mascot).toHaveAttribute('data-asset', 'alfi/alfi-idle.svg');
  });

  it('supports explicit numeric pixel size and custom click handlers', () => {
    const handleClick = vi.fn();
    render(<AlfiMascot size={120} onClick={handleClick} />);
    const mascot = screen.getByTestId('alfi-mascot');
    expect(mascot).toHaveStyle({ width: '120px', height: '120px' });
    fireEvent.click(mascot);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe('AlfiAvatar Component', () => {
  it('renders avatar with status indicators and status dot', () => {
    const { rerender } = render(<AlfiAvatar status="idle" size="md" />);
    expect(screen.getByRole('img')).toHaveAttribute('data-status', 'idle');
    expect(screen.getByTestId('alfi-status-dot')).toHaveClass('bg-emerald-500');

    rerender(<AlfiAvatar status="thinking" size="lg" />);
    expect(screen.getByRole('img')).toHaveAttribute('data-status', 'thinking');
    expect(screen.getByTestId('alfi-status-dot')).toHaveClass('bg-amber-400');

    rerender(<AlfiAvatar status="streaming" size="sm" />);
    expect(screen.getByTestId('alfi-status-dot')).toHaveClass('bg-emerald-400');

    rerender(<AlfiAvatar status="listening" size="sm" />);
    expect(screen.getByTestId('alfi-status-dot')).toHaveClass('bg-sky-400');

    rerender(<AlfiAvatar status="sleeping" size="sm" />);
    expect(screen.getByTestId('alfi-status-dot')).toHaveClass('bg-slate-400');

    rerender(<AlfiAvatar status="chasing" size="sm" />);
    expect(screen.getByTestId('alfi-status-dot')).toHaveClass('bg-rose-500');
  });
});

describe('useAlfiChatLifecycle Hook', () => {
  it('correctly maps lifecycle states', () => {
    const { result, rerender } = renderHook((props) => useAlfiChatLifecycle(props), {
      initialProps: {},
    });
    expect(result.current).toBe('idle');

    rerender({ isTyping: true });
    expect(result.current).toBe('listening');

    rerender({ isThinking: true });
    expect(result.current).toBe('thinking');

    rerender({ isStreaming: true });
    expect(result.current).toBe('speaking');

    rerender({ isToolCalling: true, activeTool: 'pantry_list_items' });
    expect(result.current).toBe('eating');

    rerender({ isToolCalling: true, activeTool: 'maintenance_schedule' });
    expect(result.current).toBe('fixing');

    rerender({ isToolCalling: true, activeTool: 'chores_assign' });
    expect(result.current).toBe('chasing');

    rerender({ isToolCalling: true, activeTool: 'generic_calculator' });
    expect(result.current).toBe('thinking');

    rerender({ isError: true });
    expect(result.current).toBe('chasing');

    rerender({ customState: 'sleeping' });
    expect(result.current).toBe('sleeping');
  });
});
