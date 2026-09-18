import { Suspense } from 'react';
import { HouseholdDetailView, HouseholdDetailSkeleton } from '@/features/household';

/**
 * Household Detail Dynamic Route.
 * Server component that unwraps dynamic params and suspends rendering using Suspense fallback.
 */
export default async function HouseholdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Suspense fallback={<HouseholdDetailSkeleton />}>
      <HouseholdDetailView householdId={id} />
    </Suspense>
  );
}
