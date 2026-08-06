import { DashboardView } from "@/features/chore_management/components/DashboardView";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  // Unwrap parameters per Next 15+ standards
  const { locale } = await params;
  return <DashboardView />;
}
