import { BoardView } from "@/features/chore_management/components/BoardView";

export default async function BoardPage({ params }: { params: Promise<{ locale: string }> }) {
  // Unwrap Next 15+ promise parameters
  await params;
  return <BoardView />;
}
