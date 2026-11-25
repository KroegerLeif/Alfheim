import { DEFAULT_LAUNCHER_ICON, LAUNCHER_ICONS } from '../icons';

interface LauncherIconProps {
  /** Icon name stored with the launcher; unknown names show the link icon. */
  name: string;
  className?: string;
}

/** Decorative lucide icon of a launcher, looked up in the static icon map. */
export function LauncherIcon({ name, className }: LauncherIconProps) {
  const Icon = LAUNCHER_ICONS[name] ?? LAUNCHER_ICONS[DEFAULT_LAUNCHER_ICON];
  return <Icon className={className} aria-hidden="true" />;
}
