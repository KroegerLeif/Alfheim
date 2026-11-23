/** A starting point for the admin form: prefills the title and the icon. */
export interface LauncherPreset {
  id: 'home_assistant' | 'jellyfin' | 'navidrome' | 'youtube' | 'custom';
  /** Translation key of the preset name, which is also the prefilled title (empty for custom). */
  labelKey: string;
  icon: string;
  /** Whether choosing the preset fills the title with the preset name. */
  prefillTitle: boolean;
}

export const LAUNCHER_PRESETS: readonly LauncherPreset[] = [
  { id: 'home_assistant', labelKey: 'dashboard.launchers.presets.home_assistant', icon: 'house', prefillTitle: true },
  { id: 'jellyfin', labelKey: 'dashboard.launchers.presets.jellyfin', icon: 'clapperboard', prefillTitle: true },
  { id: 'navidrome', labelKey: 'dashboard.launchers.presets.navidrome', icon: 'music', prefillTitle: true },
  { id: 'youtube', labelKey: 'dashboard.launchers.presets.youtube', icon: 'play', prefillTitle: true },
  { id: 'custom', labelKey: 'dashboard.launchers.presets.custom', icon: 'link', prefillTitle: false },
];
