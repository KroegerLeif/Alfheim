import { Suspense } from 'react';
import { JoinView } from './JoinView';

/**
 * `/household/join?token=<token>`: target of invite QR codes and links.
 * The shared AuthGuard runs the login first (and restores this URL incl.
 * query afterwards), then JoinView redeems the token.
 */
export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinView />
    </Suspense>
  );
}
