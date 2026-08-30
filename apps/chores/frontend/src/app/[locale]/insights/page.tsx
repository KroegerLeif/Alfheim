import { InsightsView } from "@/features/chore_management/components/InsightsView";

export default async function InsightsPage({ params }: { params: Promise<{ locale: string }> }) {
  // Unwrap parameters per Next 15+ standards
  await params;
  return <InsightsView />;
}
