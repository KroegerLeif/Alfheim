import {
  BookOpen, Calendar, Camera, Clapperboard, Cloud, Cpu, Film, Folder, Gamepad2, Gauge, Globe,
  Headphones, House, Image, Lightbulb, Link, Lock, Mail, Music, Network, Play, Podcast, Printer,
  Radio, Router, Server, Shield, Tv, Video, Wifi, type LucideIcon,
} from 'lucide-react';

/**
 * Lucide icons a launcher may use, keyed by the name stored with the launcher. The backend
 * accepts exactly these names (core/dashboard/backend/internal/features/launchers/icons.go).
 */
export const LAUNCHER_ICONS: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  calendar: Calendar,
  camera: Camera,
  clapperboard: Clapperboard,
  cloud: Cloud,
  cpu: Cpu,
  film: Film,
  folder: Folder,
  'gamepad-2': Gamepad2,
  gauge: Gauge,
  globe: Globe,
  headphones: Headphones,
  house: House,
  image: Image,
  lightbulb: Lightbulb,
  link: Link,
  lock: Lock,
  mail: Mail,
  music: Music,
  network: Network,
  play: Play,
  podcast: Podcast,
  printer: Printer,
  radio: Radio,
  router: Router,
  server: Server,
  shield: Shield,
  tv: Tv,
  video: Video,
  wifi: Wifi,
};

export const LAUNCHER_ICON_NAMES = Object.keys(LAUNCHER_ICONS).sort();

export const DEFAULT_LAUNCHER_ICON = 'link';

/** The icon component for `name`, falling back to the link icon for unknown names. */
export function launcherIcon(name: string): LucideIcon {
  return LAUNCHER_ICONS[name] ?? LAUNCHER_ICONS[DEFAULT_LAUNCHER_ICON];
}
