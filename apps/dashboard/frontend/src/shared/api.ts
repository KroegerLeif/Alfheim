import ky from 'ky';
import {
  AppCatalogResponse,
  AppItem,
  CreateAppRequest,
  UserProfile,
  UpdateProfileRequest,
  Household,
  CreateHouseholdRequest,
  CreateInviteRequest,
  InviteCodeResponse,
  JoinHouseholdRequest,
} from './types';
import { getInMemoryToken, parseInMemoryTokenClaims } from './providers/AuthProvider';

/**
 * Get Bearer auth token dynamically from in-memory AuthProvider state.
 */
function getAuthToken(): string | null {
  return getInMemoryToken();
}

/**
 * Dynamically construct fallback identity profile from active in-memory OIDC token claims.
 */
function getDynamicFallbackProfile(): UserProfile {
  const claims = parseInMemoryTokenClaims();
  return {
    id: claims?.sub || '',
    email: claims?.email || '',
    username: claims?.preferred_username || 'user',
    first_name: claims?.given_name || '',
    last_name: claims?.family_name || '',
    avatar_url: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Dynamically construct fallback household state from active in-memory OIDC token claims.
 */
function getDynamicFallbackHouseholds(): Household[] {
  const claims = parseInMemoryTokenClaims();
  const userId = claims?.sub || '';
  const userName = claims?.name || claims?.preferred_username || 'User';
  return [
    {
      id: 'hh-default',
      name: `${userName}'s Residence`,
      slug: 'default-residence',
      owner_id: userId,
      role: 'owner',
      members: [
        {
          household_id: 'hh-default',
          user_id: userId,
          role: 'owner',
          joined_at: new Date().toISOString(),
          email: claims?.email || '',
          username: claims?.preferred_username || '',
          first_name: claims?.given_name || '',
          last_name: claims?.family_name || '',
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}

/**
 * Centralized HTTP client using `ky`.
 * Features automatic Bearer token injection and configurable timeout.
 */
export const api = ky.create({
  prefix: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  timeout: 8000,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = getAuthToken();
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      },
    ],
  },
});

// Mock Fallback Data in case the Go backend is not running locally during development
const MOCK_APP_CATALOG: AppCatalogResponse = {
  internal: [
    {
      id: 'app-1',
      name: 'Digital Pantry',
      title: 'Digital Pantry',
      slug: 'pantry',
      description: 'Manage household food inventory, recipes, and expiration dates.',
      icon_url: 'kitchen',
      icon: 'kitchen',
      app_url: '/pantry',
      url: '/pantry',
      category: 'internal',
      required_role: 'MEMBER',
      is_external: false,
      status: 'active',
      is_default: true,
      display_order: 1,
    },
    {
      id: 'app-2',
      name: 'Smart Shopping',
      title: 'Smart Shopping',
      slug: 'shopping',
      description: 'Automated shopping list generator and store price aggregator.',
      icon_url: 'shopping_cart',
      icon: 'shopping_cart',
      app_url: '/shopping',
      url: '/shopping',
      category: 'internal',
      required_role: 'MEMBER',
      is_external: false,
      status: 'active',
      is_default: true,
      display_order: 2,
    },
    {
      id: 'app-3',
      name: 'Maintenance Hub',
      title: 'Maintenance Hub',
      slug: 'maintenance',
      description: 'Schedule device maintenance and home repairs.',
      icon_url: 'build',
      icon: 'build',
      app_url: '/maintenance',
      url: '/maintenance',
      category: 'internal',
      required_role: 'MEMBER',
      is_external: false,
      status: 'active',
      is_default: true,
      display_order: 3,
    },
    {
      id: 'app-4',
      name: 'Task Tracker (TODO)',
      title: 'Task Tracker (TODO)',
      slug: 'todo',
      description: 'Manage personal and household tasks and reminders.',
      icon_url: 'checklist',
      icon: 'checklist',
      app_url: '/under-construction?app=TODO',
      url: '/under-construction?app=TODO',
      category: 'internal',
      required_role: 'MEMBER',
      is_external: false,
      status: 'in_progress',
      is_default: true,
      display_order: 4,
    },
  ],
  external: [
    {
      id: 'app-5',
      name: 'Home Assistant',
      title: 'Home Assistant',
      slug: 'home-assistant',
      description: 'Smart home automation, climate control, and security dashboard.',
      icon_url: 'home',
      icon: 'home',
      app_url: 'http://homeassistant.local',
      url: 'http://homeassistant.local',
      category: 'external',
      required_role: 'MEMBER',
      is_external: true,
      status: 'active',
      is_default: true,
      display_order: 5,
    },
    {
      id: 'app-6',
      name: 'Plex Media Server',
      title: 'Plex Media Server',
      slug: 'plex',
      description: 'Stream movies, TV shows, and personal media across devices.',
      icon_url: 'movie',
      icon: 'movie',
      app_url: '/under-construction?app=Plex',
      url: '/under-construction?app=Plex',
      category: 'external',
      required_role: 'MEMBER',
      is_external: true,
      status: 'in_progress',
      is_default: true,
      display_order: 6,
    },
    {
      id: 'app-7',
      name: 'Nextcloud Storage',
      title: 'Nextcloud Storage',
      slug: 'nextcloud',
      description: 'Private cloud storage, photos, and document synchronization.',
      icon_url: 'cloud',
      icon: 'cloud',
      app_url: '/under-construction?app=Nextcloud',
      url: '/under-construction?app=Nextcloud',
      category: 'external',
      required_role: 'MEMBER',
      is_external: true,
      status: 'in_progress',
      is_default: true,
      display_order: 7,
    },
  ],
  total: 7,
};

/* API Fetcher Functions */

export async function fetchAppCatalog(): Promise<AppCatalogResponse> {
  try {
    return await api.get('api/v1/apps').json<AppCatalogResponse>();
  } catch (error) {
    console.warn('Backend API unreachable for GET /api/v1/apps, using fallback catalog.', error);
    return MOCK_APP_CATALOG;
  }
}

export async function createApp(payload: CreateAppRequest): Promise<AppItem> {
  try {
    return await api.post('api/v1/apps', { json: payload }).json<AppItem>();
  } catch (error) {
    console.warn('Backend API unreachable for POST /api/v1/apps, generating mock app entry.', error);
    const title = payload.title || 'Custom App';
    const isExt = payload.is_external || payload.category === 'external';
    const newApp: AppItem = {
      id: `app-${Date.now()}`,
      name: title,
      title: title,
      slug: title.toLowerCase().replace(/\s+/g, '-'),
      description: payload.description || '',
      icon_url: payload.icon || 'grid_view',
      icon: payload.icon || 'grid_view',
      app_url: payload.url,
      url: payload.url,
      category: isExt ? 'external' : 'internal',
      required_role: payload.required_role || 'MEMBER',
      is_external: isExt,
      status: payload.status || 'active',
      is_default: false,
      display_order: 99,
    };

    if (isExt) {
      MOCK_APP_CATALOG.external.push(newApp);
    } else {
      MOCK_APP_CATALOG.internal.push(newApp);
    }
    MOCK_APP_CATALOG.total++;
    return newApp;
  }
}

export async function updateApp(id: string, payload: Partial<CreateAppRequest>): Promise<AppItem> {
  try {
    return await api.put(`api/v1/apps/${id}`, { json: payload }).json<AppItem>();
  } catch (error) {
    console.warn(`Backend API unreachable for PUT /api/v1/apps/${id}, updating local fallback catalog.`, error);
    let found: AppItem | undefined;
    for (const list of [MOCK_APP_CATALOG.internal, MOCK_APP_CATALOG.external]) {
      found = list.find((a) => a.id === id);
      if (found) {
        if (payload.title) {
          found.title = payload.title;
          found.name = payload.title;
        }
        if (payload.description !== undefined) found.description = payload.description;
        if (payload.url) {
          found.url = payload.url;
          found.app_url = payload.url;
        }
        if (payload.icon) {
          found.icon = payload.icon;
          found.icon_url = payload.icon;
        }
        if (payload.is_external !== undefined) found.is_external = payload.is_external;
        if (payload.status) found.status = payload.status;
        return found;
      }
    }
    throw error;
  }
}

export async function fetchUserProfile(): Promise<UserProfile> {
  try {
    return await api.get('api/v1/profile/me').json<UserProfile>();
  } catch (error) {
    console.warn('Backend API unreachable for GET /api/v1/profile/me, using dynamic claims fallback.', error);
    return getDynamicFallbackProfile();
  }
}

export async function updateUserProfile(payload: UpdateProfileRequest): Promise<UserProfile> {
  try {
    return await api.put('api/v1/profile/me', { json: payload }).json<UserProfile>();
  } catch (error) {
    console.warn('Backend API unreachable for PUT /api/v1/profile/me, returning updated dynamic profile.', error);
    const profile = getDynamicFallbackProfile();
    profile.first_name = payload.first_name;
    profile.last_name = payload.last_name;
    profile.avatar_url = payload.avatar_url || '';
    profile.updated_at = new Date().toISOString();
    return profile;
  }
}

export async function fetchHouseholds(): Promise<Household[]> {
  try {
    return await api.get('api/v1/households/me').json<Household[]>();
  } catch (error) {
    console.warn('Backend API unreachable for GET /api/v1/households/me, using dynamic claims fallback.', error);
    return getDynamicFallbackHouseholds();
  }
}

export async function createHousehold(payload: CreateHouseholdRequest): Promise<Household> {
  try {
    const slug = payload.slug || payload.name.toLowerCase().replace(/\s+/g, '-');
    return await api.post('api/v1/households', { json: { name: payload.name, slug } }).json<Household>();
  } catch (error) {
    console.warn('Backend API unreachable for POST /api/v1/households, generating mock household.', error);
    const claims = parseInMemoryTokenClaims();
    const userId = claims?.sub || '';
    const newHh: Household = {
      id: `hh-${Date.now()}`,
      name: payload.name,
      slug: payload.slug || payload.name.toLowerCase().replace(/\s+/g, '-'),
      owner_id: userId,
      role: 'owner',
      members: [
        {
          household_id: `hh-${Date.now()}`,
          user_id: userId,
          role: 'owner',
          joined_at: new Date().toISOString(),
          email: claims?.email || '',
          username: claims?.preferred_username || '',
          first_name: claims?.given_name || '',
          last_name: claims?.family_name || '',
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return newHh;
  }
}

export async function createHouseholdInvite(payload: CreateInviteRequest): Promise<InviteCodeResponse> {
  try {
    return await api.post('api/v1/households/invite', { json: payload }).json<InviteCodeResponse>();
  } catch (error) {
    console.warn('Backend API unreachable for POST /api/v1/households/invite, generating mock invite token.', error);
    return {
      token: `INV-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      household_id: payload.household_id,
      role: payload.role,
      expires_at: new Date(Date.now() + payload.ttl_minutes * 60000).toISOString(),
      max_uses: payload.max_uses,
      uses: 0,
    };
  }
}

export async function joinHousehold(payload: JoinHouseholdRequest): Promise<Household> {
  try {
    return await api.post('api/v1/households/join', { json: payload }).json<Household>();
  } catch (error) {
    console.warn('Backend API unreachable for POST /api/v1/households/join, returning dynamic household.', error);
    return getDynamicFallbackHouseholds()[0];
  }
}
