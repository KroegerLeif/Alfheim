import { redirect } from "@/navigation";

interface LocaleIndexProps {
  params: Promise<{ locale: string }>;
}

export default async function LocaleIndexPage({ params }: LocaleIndexProps) {
  const { locale } = await params;
  redirect({ href: "/catalog", locale });
}
