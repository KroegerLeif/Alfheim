import { BerserkerView } from "@/features/session";

interface SessionPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = await params;
  return <BerserkerView sessionId={sessionId} />;
}
