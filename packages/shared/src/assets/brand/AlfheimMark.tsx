import React from 'react';

export interface AlfheimMarkProps extends Omit<React.SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Rendered width and height in pixels. */
  size?: number;
}

/**
 * The Alfheim line-art brand mark (hexagonal crystal) as a reusable, themeable SVG component.
 * It strokes with `currentColor`, so callers control its color through CSS `color` / text utilities.
 * The static file equivalents live in `brand/logo-mark.svg` and `brand/logo-mark-white.svg`.
 */
export function AlfheimMark({ size = 24, ...props }: AlfheimMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
      <path d="M12 22V12" />
      <path d="M12 12L3 7" />
      <path d="M12 12l9-5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}
