import ky from 'ky';
import {
  AppCatalogResponse,
  UserProfile,
  UpdateProfileRequest,
  Household,
  CreateInviteRequest,
  InviteCodeResponse,
  JoinHouseholdRequest,
} from './types';
import { getInMemoryToken } from './providers/AuthProvider';

/**
 * Get Bearer auth token dynamically from in-memory AuthProvider state.
 */
function getAuthToken(): string | null {
  return getInMemoryToken();
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
      slug: 'pantry',
      description: 'Manage household food inventory, recipes, and expiration dates.',
      icon_url: 'kitchen',
      app_url: '/pantry',
      category: 'household',
      required_role: 'user',
      display_order: 1,
    },
    {
      id: 'app-2',
      name: 'Smart Shopping',
      slug: 'shopping',
      description: 'Automated shopping list generator and store price aggregator.',
      icon_url: 'shopping_cart',
      app_url: '/shopping',
      category: 'household',
      required_role: 'user',
      display_order: 2,
    },
    {
      id: 'app-3',
      name: 'Maintenance Hub',
      slug: 'maintenance',
      description: 'Schedule device maintenance and home repairs.',
      icon_url: 'build',
      app_url: '/maintenance',
      category: 'utility',
      required_role: 'admin',
      display_order: 3,
    },
  ],
  external: [
    {
      id: 'app-4',
      name: 'Keycloak IAM Portal',
      slug: 'keycloak',
      description: 'Identity access management, security tokens, and user realm admin.',
      icon_url: 'security',
      app_url: 'http://localhost:8080/auth',
      category: 'admin',
      required_role: 'admin',
      display_order: 4,
    },
  ],
  total: 4,
};

const MOCK_PROFILE: UserProfile = {
  id: 'usr-101',
  email: 'leif.kroeger@loeger-os.local',
  username: 'leifkroeger',
  first_name: 'Leif',
  last_name: 'Kroeger',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-07-25T12:00:00Z',
};

const MOCK_HOUSEHOLDS: Household[] = [
  {
    id: 'hh-1',
    name: 'Kroeger Residence',
    slug: 'kroeger-residence',
    owner_id: 'usr-101',
    role: 'owner',
    members: [
      {
        household_id: 'hh-1',
        user_id: 'usr-101',
        role: 'owner',
        joined_at: '2026-01-15T10:00:00Z',
      },
      {
        household_id: 'hh-1',
        user_id: 'usr-102',
        role: 'member',
        joined_at: '2026-02-01T14:30:00Z',
      },
    ],
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-07-20T16:45:00Z',
  },
];

/* API Fetcher Functions */

export async function fetchAppCatalog(): Promise<AppCatalogResponse> {
  try {
    return await api.get('api/v1/apps').json<AppCatalogResponse>();
  } catch (error) {
    console.warn('Backend API unreachable for GET /api/v1/apps, using fallback mock data.', error);
    return MOCK_APP_CATALOG;
  }
}

export async function fetchUserProfile(): Promise<UserProfile> {
  try {
    return await api.get('api/v1/profile/me').json<UserProfile>();
  } catch (error) {
    console.warn('Backend API unreachable for GET /api/v1/profile/me, using fallback mock data.', error);
    return MOCK_PROFILE;
  }
}

export async function updateUserProfile(payload: UpdateProfileRequest): Promise<UserProfile> {
  try {
    return await api.put('api/v1/profile/me', { json: payload }).json<UserProfile>();
  } catch (error) {
    console.warn('Backend API unreachable for PUT /api/v1/profile/me, updating local mock state.', error);
    MOCK_PROFILE.first_name = payload.first_name;
    MOCK_PROFILE.last_name = payload.last_name;
    MOCK_PROFILE.avatar_url = payload.avatar_url;
    MOCK_PROFILE.updated_at = new Date().toISOString();
    return { ...MOCK_PROFILE };
  }
}

export async function fetchHouseholds(): Promise<Household[]> {
  try {
    return await api.get('api/v1/households/me').json<Household[]>();
  } catch (error) {
    console.warn('Backend API unreachable for GET /api/v1/households/me, using fallback mock data.', error);
    return MOCK_HOUSEHOLDS;
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
    console.warn('Backend API unreachable for POST /api/v1/households/join, returning mock household.', error);
    return MOCK_HOUSEHOLDS[0];
  }
}
