'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { HouseholdDetailView, HouseholdDetailSkeleton } from '@/features/household';

/**
 * Household Detail Dynamic Route.
 * Wrapped in a React Suspense boundary to prevent hydration crashes during Keycloak redirects.
 */
export default function HouseholdDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <Suspense fallback={<HouseholdDetailSkeleton />}>
      <HouseholdDetailView householdId={id} />
    </Suspense>
  );
}
