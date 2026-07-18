import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("Navigation");
  return (
    <main className="p-8 flex flex-col gap-4">
      <h1 className="text-3xl font-heading font-black tracking-wide leading-none">{t("title")}</h1>
      <p className="text-sm font-mono text-muted-foreground">{t("subtitle")}</p>
    </main>
  );
}
