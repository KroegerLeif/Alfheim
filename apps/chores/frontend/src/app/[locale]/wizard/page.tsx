import { WizardView } from "@/features/chore_management/components/WizardView";

export default async function WizardPage({ params }: { params: Promise<{ locale: string }> }) {
  // Unwrap parameters per Next 15+ standards
  const { locale } = await params;
  return <WizardView />;
}
