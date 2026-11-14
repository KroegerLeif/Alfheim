import type { LucideIcon } from 'lucide-react';
import {
  Package,
  ShoppingCart,
  Wrench,
  CheckSquare,
  Wallet,
  BookOpen,
  Dumbbell,
  MessageSquare,
  LayoutDashboard,
} from 'lucide-react';

/**
 * One module card on the landing page. Translatable text (name, tagline, description) is read
 * from `docs.modules.<id>.*`; the remaining fields are technical facts shown verbatim.
 */
export interface AppModule {
  id: string;
  icon: LucideIcon;
  /** Gradient, text and border utilities of the icon tile. */
  color: string;
  /** Background, text and border utilities of the tech badge. */
  tagColor: string;
  tech: string;
  db: string;
  route: string;
  api: string;
}

/** Modules shown in the landing page grid, in display order. */
export const APP_MODULES: readonly AppModule[] = [
  {
    id: 'pantry',
    icon: Package,
    color: 'from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30',
    tagColor: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    tech: 'FastAPI + Next.js',
    db: 'PostgreSQL (pantry-db)',
    route: '/pantry',
    api: 'api.alfheim.loegien.de/pantry/api/v1',
  },
  {
    id: 'shopping',
    icon: ShoppingCart,
    color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30',
    tagColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    tech: 'FastAPI + Next.js',
    db: 'PostgreSQL (shopping-db)',
    route: '/shopping',
    api: 'api.alfheim.loegien.de/shopping/api/v1',
  },
  {
    id: 'maintenance',
    icon: Wrench,
    color: 'from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30',
    tagColor: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    tech: 'FastAPI + Next.js',
    db: 'PostgreSQL (maintenance-db)',
    route: '/maintenance',
    api: 'api.alfheim.loegien.de/maintenance/api/v1',
  },
  {
    id: 'chores',
    icon: CheckSquare,
    color: 'from-purple-500/20 to-pink-500/10 text-purple-400 border-purple-500/30',
    tagColor: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    tech: 'FastAPI + Next.js',
    db: 'PostgreSQL (chores-db)',
    route: '/chores',
    api: 'api.alfheim.loegien.de/chores/api/v1',
  },
  {
    id: 'budget',
    icon: Wallet,
    color: 'from-teal-500/20 to-emerald-500/10 text-teal-400 border-teal-500/30',
    tagColor: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
    tech: 'FastAPI + Next.js',
    db: 'PostgreSQL (budget-db)',
    route: '/budget',
    api: 'api.alfheim.loegien.de/budget/api/v1',
  },
  {
    id: 'library',
    icon: BookOpen,
    color: 'from-violet-500/20 to-purple-500/10 text-violet-400 border-violet-500/30',
    tagColor: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
    tech: 'FastAPI + Next.js',
    db: 'PostgreSQL (library-db)',
    route: '/library',
    api: 'api.alfheim.loegien.de/library/api/v1',
  },
  {
    id: 'workout',
    icon: Dumbbell,
    color: 'from-rose-500/20 to-red-500/10 text-rose-400 border-rose-500/30',
    tagColor: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    tech: 'FastAPI + Next.js',
    db: 'PostgreSQL (workout-db)',
    route: '/workout',
    api: 'api.alfheim.loegien.de/workout/api/v1',
  },
  {
    id: 'chat',
    icon: MessageSquare,
    color: 'from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/30',
    tagColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    tech: 'Go 1.23 + Next.js',
    db: 'PostgreSQL (chat-db)',
    route: '/chat',
    api: 'api.alfheim.loegien.de/chat/api/v1',
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    color: 'from-sky-500/20 to-indigo-500/10 text-sky-400 border-sky-500/30',
    tagColor: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    tech: 'Go 1.23 + Next.js',
    db: 'PostgreSQL (dashboard-db)',
    route: '/',
    api: 'api.alfheim.loegien.de/api/v1/apps',
  },
];
