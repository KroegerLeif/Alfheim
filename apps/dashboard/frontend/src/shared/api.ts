import ky from 'ky';

/**
 * Centralized HTTP client using `ky`.
 * All external API communication for the Dashboard application must use this instance.
 */
export const api = ky.create({
  prefix: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});
