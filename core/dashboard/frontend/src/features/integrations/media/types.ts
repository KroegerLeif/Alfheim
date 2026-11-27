/** Playback commands the media API accepts. */
export const MEDIA_COMMANDS = ['previous', 'play_pause', 'next', 'stop'] as const;

export type MediaCommand = (typeof MEDIA_COMMANDS)[number];

/** One active playback session, independent of the server type (`MediaStatus` in the backend). */
export interface MediaStatus {
  source: string;
  session_id: string;
  title: string;
  artist: string;
  device: string;
  state: 'playing' | 'paused';
  can_control: boolean;
}

/** How one enabled media server answered: `ok` or a failure code such as `auth_failed`. */
export interface MediaSourceState {
  source: string;
  status: string;
}

/** Body of `GET /api/v1/integrations/media/now-playing`. */
export interface NowPlaying {
  items: MediaStatus[] | null;
  sources: MediaSourceState[] | null;
}

/** One credential input of a media server settings form. */
export interface MediaCredentialField {
  /** Backend credential name, for example `api_key`. */
  name: string;
  /** i18n key of the field label. */
  labelKey: string;
  type: 'text' | 'password';
}
