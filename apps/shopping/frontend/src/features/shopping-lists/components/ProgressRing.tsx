import { useTranslations } from "next-intl";

interface ProgressRingProps {
  /** Completion in percent, 0 to 100. */
  percentage: number;
}

/** Circular completion indicator drawn with a conic gradient (no inline SVG). */
export function ProgressRing({ percentage }: ProgressRingProps) {
  const t = useTranslations("Checklist");
  const clamped = Math.min(Math.max(percentage, 0), 100);

  return (
    <div
      role="progressbar"
      aria-label={t("progress")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className="relative w-8 h-8 rounded-full shrink-0 transition-all duration-500 ease-out"
      style={{
        background: `conic-gradient(var(--primary-main) ${clamped * 3.6}deg, var(--border-subtle) 0deg)`,
      }}
    >
      <div className="absolute inset-[3.5px] rounded-full bg-[var(--surface-canvas)]" />
    </div>
  );
}
