import Link from 'next/link';
import type { ReactNode } from 'react';

interface NavAnchorProps {
  href: string;
  /**
   * The target is served by another app behind Caddy (e.g. core/household), so it
   * needs a full-page navigation instead of Next.js client-side routing.
   */
  external?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Navigation link that uses Next.js `<Link>` for routes inside the dashboard and a
 * plain `<a href>` for routes that leave this app.
 */
export function NavAnchor({ href, external, className, children }: NavAnchorProps) {
  if (external) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
