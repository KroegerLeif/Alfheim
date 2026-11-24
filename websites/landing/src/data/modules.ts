import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BookOpen,
  CheckSquare,
  Dumbbell,
  LayoutDashboard,
  MessageSquare,
  Package,
  ShoppingCart,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

/**
 * One module card on the landing page. Name and description are read from
 * `docs.modules.items.<id>.*`; the other fields are technical facts shown verbatim.
 *
 * Tier, routes and dependencies mirror docs/en/reference/apps-catalog.md and ADR 0007.
 */
export interface AppModule {
  /** App id, also the argument of `alfheim-setup apps enable <id>`. */
  id: string;
  icon: LucideIcon;
  /** `core` modules always run; `optional` ones are switched with `alfheim-setup apps`. */
  tier: 'core' | 'optional';
  /** Page path on the operator's own domain. */
  route: string;
  /**
   * API path on the operator's own domain (`https://<your-domain>/api/v1/<app>`), as routed by
   * Caddy; see docs/en/reference/ingress-matrix.md. Absent for modules without an API.
   */
  api?: string;
  /** App id that must be enabled first. */
  requires?: string;
}

/** Modules shown in the landing page grid: core first, then optional in catalog order. */
export const APP_MODULES: readonly AppModule[] = [
  { id: 'dashboard', icon: LayoutDashboard, tier: 'core', route: '/', api: '/api/v1/apps' },
  { id: 'household', icon: Users, tier: 'core', route: '/household', api: '/api/v1/households' },
  { id: 'pantry', icon: Package, tier: 'optional', route: '/pantry', api: '/api/v1/pantry' },
  {
    id: 'shopping',
    icon: ShoppingCart,
    tier: 'optional',
    route: '/shopping',
    api: '/api/v1/shopping',
    requires: 'pantry',
  },
  { id: 'budget', icon: Wallet, tier: 'optional', route: '/budget', api: '/api/v1/budget' },
  { id: 'chores', icon: CheckSquare, tier: 'optional', route: '/chores', api: '/api/v1/chores' },
  { id: 'library', icon: BookOpen, tier: 'optional', route: '/library', api: '/api/v1/library' },
  { id: 'workout', icon: Dumbbell, tier: 'optional', route: '/workout', api: '/api/v1/workout' },
  { id: 'maintenance', icon: Wrench, tier: 'optional', route: '/maintenance', api: '/api/v1/maintenance' },
  { id: 'chat', icon: MessageSquare, tier: 'optional', route: '/chat', api: '/api/v1/chat' },
  { id: 'telemetry', icon: Activity, tier: 'optional', route: '/grafana' },
];
