import React from 'react';

/** Props of {@link SectionHeader}. */
interface SectionHeaderProps {
  /** Id of the heading, referenced by the section's `aria-labelledby`. */
  id: string;
  badge: string;
  title: string;
  subtitle?: string;
}

/** Centred badge, heading and optional subtitle that open every landing page section. */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ id, badge, title, subtitle }) => (
  <div className="text-center max-w-3xl mx-auto mb-12">
    <span className="text-xs font-mono uppercase px-3 py-1 rounded-full bg-card border border-line text-primary">
      {badge}
    </span>
    <h2 id={id} className="text-3xl sm:text-4xl font-bold text-fg mt-3">
      {title}
    </h2>
    {subtitle && <p className="text-muted mt-3 text-base leading-relaxed">{subtitle}</p>}
  </div>
);
