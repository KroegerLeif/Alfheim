import React from 'react';
import { Globe2, Plug, Terminal, ShieldCheck } from 'lucide-react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import type { AppModule } from '../../data/modules';

/** Props of {@link AppModuleCard}. */
interface AppModuleCardProps {
  app: AppModule;
}

/** Card for one module: tier badge, texts, routes and how to switch it on. */
export const AppModuleCard: React.FC<AppModuleCardProps> = ({ app }) => {
  const { t } = useDocTranslation();
  const Icon = app.icon;
  const isCore = app.tier === 'core';

  return (
    <li className="glass-card rounded-2xl p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/30 text-primary">
            <Icon aria-hidden="true" className="w-6 h-6" />
          </div>
          <span
            className={`text-xs font-mono uppercase px-2.5 py-1 rounded-md border ${
              isCore
                ? 'bg-success/10 text-success border-success/30'
                : 'bg-primary/10 text-primary border-primary/30'
            }`}
          >
            {isCore ? t('docs.modules.core') : t('docs.modules.optional')}
          </span>
        </div>

        <h3 className="text-xl font-bold text-fg">{t(`docs.modules.items.${app.id}.name`)}</h3>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          {t(`docs.modules.items.${app.id}.description`)}
        </p>
      </div>

      <dl className="mt-6 pt-4 border-t border-line space-y-2 text-xs font-mono text-muted">
        <div className="flex items-center justify-between gap-2">
          <dt className="flex items-center gap-1.5">
            <Globe2 aria-hidden="true" className="w-3.5 h-3.5 text-primary" />
            {t('docs.modules.routeLabel')}
          </dt>
          <dd className="text-fg">{app.route}</dd>
        </div>
        {app.api && (
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5">
              <Plug aria-hidden="true" className="w-3.5 h-3.5 text-primary" />
              {t('docs.modules.apiLabel')}
            </dt>
            <dd className="text-fg">{app.api}</dd>
          </div>
        )}
        <div className="pt-2">
          <dt className="sr-only">{t('docs.modules.enableLabel')}</dt>
          <dd className="flex items-center gap-1.5 rounded-lg bg-canvas border border-line px-2.5 py-1.5 text-fg">
            {isCore ? (
              <>
                <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-success shrink-0" />
                <span className="font-sans">{t('docs.modules.alwaysOn')}</span>
              </>
            ) : (
              <>
                <Terminal aria-hidden="true" className="w-3.5 h-3.5 text-primary shrink-0" />
                <code className="break-all">alfheim-setup apps enable {app.id}</code>
              </>
            )}
          </dd>
          {app.requires && (
            <dd className="mt-1.5 font-sans">
              {t('docs.modules.requires', { app: t(`docs.modules.items.${app.requires}.name`) })}
            </dd>
          )}
        </div>
      </dl>
    </li>
  );
};
