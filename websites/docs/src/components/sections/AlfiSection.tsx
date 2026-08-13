import React, { useState } from 'react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { AlfiMascot } from '../icons/AlfiMascot';
import { Sparkles, Bot, Cpu, CheckCircle2, MessageSquareCode } from 'lucide-react';
import { AlfiState } from '@alfheim/shared';

export const AlfiSection: React.FC = () => {
  const { t } = useDocTranslation();
  const [mascotState, setMascotState] = useState<AlfiState>('idle');

  const capabilities = [
    t('docs.alfi.cap1', 'Proactive inventory restocking & deficit detection'),
    t('docs.alfi.cap2', 'Natural language recipe suggestions from available pantry items'),
    t('docs.alfi.cap3', 'Automated maintenance scheduling & warranty ingestion'),
    t('docs.alfi.cap4', 'Fair chore allocation & streak preservation reminders'),
  ];

  const statesList: { key: AlfiState; label: string }[] = [
    { key: 'idle', label: 'Idle' },
    { key: 'thinking', label: 'Thinking' },
    { key: 'loading', label: 'Syncing' },
    { key: 'curious', label: 'Curious' },
    { key: 'sleeping', label: 'Standby' },
  ];

  const cycleState = () => {
    const order: AlfiState[] = ['idle', 'thinking', 'loading', 'curious', 'sleeping'];
    const nextIdx = (order.indexOf(mascotState) + 1) % order.length;
    setMascotState(order[nextIdx]);
  };

  return (
    <section id="alfi" className="py-16 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl p-8 sm:p-12 border border-[#3eb1ff]/20 bg-gradient-to-br from-[#111b33] via-[#0e172e] to-[#182542] specular-border relative">
          {/* Ambient Glow */}
          <div className="absolute top-1/2 right-1/4 w-80 h-80 bg-[#3eb1ff]/10 blur-3xl rounded-full pointer-events-none -z-10" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Mascot Visual */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center text-center">
              <div className="relative group">
                <AlfiMascot
                  state={mascotState}
                  onClick={cycleState}
                  className="w-56 h-56 sm:w-64 sm:h-64 transition-transform group-hover:scale-105"
                  size={256}
                />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#111b33]/90 border border-[#3eb1ff]/40 px-3 py-1 rounded-full text-xs font-mono text-[#3eb1ff] flex items-center gap-1.5 shadow-lg whitespace-nowrap">
                  <Bot className="w-3.5 h-3.5" />
                  <span>ALFI Core 2.0 ({mascotState})</span>
                </div>
              </div>

              {/* State Switcher Pills */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5 bg-[#0b1326]/80 p-1.5 rounded-xl border border-[#1c2847]">
                {statesList.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setMascotState(key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                      mascotState === key
                        ? 'bg-[#3eb1ff] text-[#0b1326] font-bold shadow-md shadow-[#3eb1ff]/20'
                        : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#182542]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Description */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3eb1ff]/10 border border-[#3eb1ff]/30 text-xs font-mono text-[#3eb1ff]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('docs.alfi.badge', 'Autonomous Companion')}</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold text-[#f0f6fc] leading-tight">
                {t('docs.alfi.title', 'Meet ALFI: Your Ambient Household Companion')}
              </h2>

              <p className="text-base text-[#8b949e] leading-relaxed">
                {t(
                  'docs.alfi.description',
                  'ALFI is the intelligent orchestration layer for Alfheim. Interacting through natural language and Model Context Protocol (MCP) tools, ALFI proactively manages groceries, schedules maintenance, and distributes chores.'
                )}
              </p>

              {/* Capability Checklist */}
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wider text-[#f0f6fc] font-mono flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#3eb1ff]" />
                  {t('docs.alfi.capabilitiesTitle', 'Core AI Capabilities')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {capabilities.map((cap, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-[#0b1326]/60 border border-[#1c2847] text-xs text-[#f0f6fc]"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#3eb1ff] shrink-0 mt-0.5" />
                      <span>{cap}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* FastMCP / Tool Calling Protocol Footer */}
              <div className="pt-2 flex items-center gap-3 text-xs font-mono text-[#8b949e]">
                <MessageSquareCode className="w-4 h-4 text-[#3eb1ff]" />
                <span>Model Context Protocol (FastMCP) · Event-Driven S3 & Telemetry Hooks</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
