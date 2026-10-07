import {
  LayoutDashboard,
  ShoppingBag,
  Archive,
  Wrench,
  SquareCheckBig,
  Dumbbell,
  type LucideIcon,
} from 'lucide-react';

/**
 * Line-art glyphs used by `AppLogo` for each app slug. Swap an entry here to change an
 * app's icon everywhere; apps without an entry fall back to the Alfheim brand mark.
 */
export const APP_GLYPH_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  shopping: ShoppingBag,
  pantry: Archive,
  maintenance: Wrench,
  chores: SquareCheckBig,
  workout: Dumbbell,
};
