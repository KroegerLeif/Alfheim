/** A household-managed link tile, as `GET /api/v1/launchers` returns it. */
export interface Launcher {
  id: string;
  title: string;
  url: string;
  icon: string;
  description: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/** Body of `POST /api/v1/launchers` and `PUT /api/v1/launchers/{id}`; never carries a household id. */
export interface LauncherInput {
  title: string;
  url: string;
  icon: string;
  description: string;
  display_order: number;
}

/** Page object of `GET /api/v1/launchers` (ADR 0011). */
export interface LauncherPage {
  items: Launcher[] | null;
  total: number;
  limit: number;
  offset: number;
}
