'use client';

import React from 'react';
import { AppHeader, AppHeaderProps } from './AppHeader';

export type GlobalHeaderProps = AppHeaderProps;

/**
 * GlobalHeader is an alias for the unified AppHeader component.
 */
export function GlobalHeader(props: GlobalHeaderProps) {
  return <AppHeader {...props} />;
}
