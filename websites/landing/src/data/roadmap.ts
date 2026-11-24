/** A planned release on the landing page roadmap. */
export interface RoadmapRelease {
  /** Translation key under `docs.roadmap.releases`. */
  id: 'v060' | 'v070';
  version: string;
  /** GitHub milestone that tracks the release. */
  milestoneUrl: string;
}

/** Upcoming releases, oldest first. Themes follow the milestone descriptions on GitHub. */
export const ROADMAP: readonly RoadmapRelease[] = [
  { id: 'v060', version: 'v0.6.0', milestoneUrl: 'https://github.com/KroegerLeif/Alfheim/milestone/3' },
  { id: 'v070', version: 'v0.7.0', milestoneUrl: 'https://github.com/KroegerLeif/Alfheim/milestone/6' },
];
