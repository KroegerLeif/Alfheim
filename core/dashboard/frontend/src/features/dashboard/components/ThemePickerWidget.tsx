'use client';

import { useTheme, useTranslation, THEME_TOKENS, ThemeVariant } from '@alfheim/shared';

export function ThemePickerWidget() {
  const { t } = useTranslation();
  const { variant, setVariant, resolvedMode } = useTheme();
  const availableVariants = Object.keys(THEME_TOKENS) as ThemeVariant[];

  return (
    <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
      <h2 className="text-base font-bold text-[var(--text-main)] mb-1">
        {t('settings.theme_title')}
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-5">
        {t('settings.theme_subtitle')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {availableVariants.map((v) => {
          const tokens = THEME_TOKENS[v][resolvedMode];
          const isSelected = variant === v;

          return (
            <div
              key={v}
              onClick={() => setVariant(v)}
              className={`p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-[var(--surface-card)] border-[var(--primary-main)] shadow-[0_0_20px_var(--accent-glow)]'
                  : 'bg-[var(--surface-canvas)] border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold font-mono text-[var(--text-main)]">
                    {t(`settings.${v}_title`)}
                  </span>
                  {isSelected && (
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[var(--primary-main)]/20 text-[var(--primary-main)] border border-[var(--primary-main)]/40 font-bold">
                      {t('common.active')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  {t(`settings.${v}_desc`)}
                </p>
              </div>

              <div
                className="h-10 rounded-lg border border-[var(--border-subtle)] p-2 flex items-center gap-2"
                style={{ backgroundColor: tokens.surfaceCanvas }}
              >
                <div
                  className="w-4 h-4 rounded-full shadow-xs"
                  style={{ backgroundColor: tokens.primaryMain }}
                  title={tokens.primaryMain}
                />
                <div
                  className="w-4 h-4 rounded-full shadow-xs"
                  style={{ backgroundColor: tokens.accentMint || tokens.accentCyan || tokens.primaryHover }}
                  title={tokens.accentMint || tokens.accentCyan}
                />
                <div
                  className="w-8 h-2 rounded opacity-50"
                  style={{ backgroundColor: tokens.surfaceElevated }}
                />
                <div
                  className="w-6 h-2 rounded ml-auto opacity-75"
                  style={{ backgroundColor: tokens.primaryMain }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
