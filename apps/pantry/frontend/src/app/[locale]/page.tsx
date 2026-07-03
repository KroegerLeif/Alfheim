import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const t = useTranslations("Dashboard");

  return (
    <main className="flex-1 flex flex-col p-8 md:p-16 max-w-7xl mx-auto w-full">
      {/* Header section */}
      <header className="border-b border-border pb-6 mb-8 flex flex-col md:flex-row md:items-baseline md:justify-between gap-4">
        <div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground leading-none">
            {t("title")}
          </h1>
          <p className="font-mono text-xs uppercase text-muted-foreground mt-2 tracking-wider">
            {t("subtitle")}
          </p>
        </div>
        <div className="font-mono text-sm tracking-wide bg-neutral-100 px-3 py-1">
          LOEGER-OS // PANTRY
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Low Stock Feature Card */}
        <section className="border border-border p-6 flex flex-col justify-between min-h-[300px]">
          <div>
            <h2 className="text-2xl font-bold border-b border-border pb-3 mb-4">
              {t("lowStock")}
            </h2>
            <p className="text-muted-foreground text-sm font-body leading-relaxed">
              The API client (`src/lib/api.ts`) and React Query hooks (`src/features/inventory/services/inventoryService.ts`) are fully integrated. Ready to render and update backend records.
            </p>
          </div>
          <div className="mt-8">
            <button className="bg-primary text-primary-foreground font-mono text-xs uppercase px-4 py-3 hover:bg-neutral-800 transition-colors cursor-pointer select-none">
              {t("exportList")}
            </button>
          </div>
        </section>

        {/* Expiration Summary Feature Card */}
        <section className="border border-border p-6 flex flex-col justify-between min-h-[300px]">
          <div>
            <h2 className="text-2xl font-bold border-b border-border pb-3 mb-4">
              {t("expiration")}
            </h2>
            <div className="space-y-4 font-mono text-sm">
              <div className="flex justify-between border-b border-dashed border-neutral-300 pb-2">
                <span>{t("itemsExpired")}</span>
                <span className="font-bold text-red-600">--</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-neutral-300 pb-2">
                <span>{t("itemsValid")}</span>
                <span className="font-bold text-green-600">--</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-neutral-300 pb-2">
                <span>{t("itemsUntracked")}</span>
                <span className="font-bold text-neutral-500">--</span>
              </div>
            </div>
          </div>
          <div className="text-xs font-mono text-muted-foreground pt-4">
            * EXPIRED ITEMS REQUIRE PHYSICAL AUDIT
          </div>
        </section>
      </div>
    </main>
  );
}
