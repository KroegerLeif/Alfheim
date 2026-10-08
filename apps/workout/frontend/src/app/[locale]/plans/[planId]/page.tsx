import { Suspense } from "react";
import { PlanDetailView } from "@/features/plans";

interface PlanDetailPageProps {
  params: Promise<{ planId: string }>;
}

export default async function PlanDetailPage({ params }: PlanDetailPageProps) {
  const { planId } = await params;

  return (
    <Suspense fallback={null}>
      <PlanDetailView planId={planId} />
    </Suspense>
  );
}
