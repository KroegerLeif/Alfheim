import { Package } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Visual pill badge displayed next to items linked to the digital Pantry database.
 */
export function PantryBadge() {
  const t = useTranslations("Checklist");

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px]
                 bg-cyan-500/10 dark:bg-cyan-500/5
                 border border-cyan-400/30 dark:border-cyan-400/20
                 text-[0.6rem] font-mono font-bold uppercase tracking-wider
                 text-cyan-600 dark:text-cyan-400 leading-none whitespace-nowrap shrink-0 select-none"
    >
      <Package className="h-2 w-2 shrink-0" strokeWidth={2.5} />
      {t("pantryBadge")}
    </span>
  );
}
