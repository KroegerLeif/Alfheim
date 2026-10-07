# Household frontend

The Next.js app for households, members, roles, invites, contacts and the
user profile. Caddy serves it under `/household` (Next.js `basePath`), and the
container listens on port 3000 (compose service `household-frontend`).

📖 **Full specification** — routes, the internal membership API, roles and
household scoping for every other app — lives in the documentation portal:
[Reference → Household](../../../docs/en/reference/apps/household.md)

## Quickstart

```sh
# from the repo root
pnpm install
cd core/household/frontend
pnpm dev            # http://localhost:3000/household
```

For local login, set `NEXT_PUBLIC_OIDC_ISSUER` and `NEXT_PUBLIC_OIDC_CLIENT_ID`
in `.env.local`. In a container, `/household/runtime-config.js` provides them
at runtime. Register the Zitadel redirect URI `<origin>/household/`.

API calls use relative `/api/v1/...` URLs on the same host, or
`NEXT_PUBLIC_API_URL` if you set it.

## Scripts

| Command            | Purpose                  |
| ------------------ | ------------------------ |
| `pnpm dev`         | Dev server               |
| `pnpm lint`        | ESLint                   |
| `pnpm check-types` | `tsc --noEmit`           |
| `pnpm test`        | Vitest (jsdom + MSW)     |
| `pnpm build`       | Production build         |

## Routes

| URL                                | Page                                          |
| ---------------------------------- | --------------------------------------------- |
| `/household`                       | Household list, create and join               |
| `/household/[id]`                  | Detail: members, roles, invites, address, contacts, settings |
| `/household/onboarding`            | Create or join; shown when the user has no household |
| `/household/join?token=<token>`    | Redeems an invite after login (QR code target) |
| `/household/profile`               | User profile                                  |

Other apps can import the URL constants and helpers from `src/lib/routes.ts`
(`HOUSEHOLD_ONBOARDING_URL`, `buildJoinUrl`, `redirectToHouseholdOnboarding`)
or copy the literal paths.

## Conventions

- **Active household:** `src/lib/activeHousehold.ts` delegates to the shared
  store in `@alfheim/shared` (`localStorage.alfheim_active_household_id` plus a
  `storage-household-changed` event), the same one every app's
  `HouseholdProvider` and the header switcher use. Create, join, leave, delete
  and set-default call `notifyHouseholdsChanged()` so other apps reload their
  household list.
- **Roles:** the app never sends `X-Household-Role`. UI actions are gated by
  the `role` field in the household detail response
  (`src/features/household/permissions.ts`), and the backend enforces the
  same rules.
- **i18n:** new strings live in `src/i18n/messages/{en,de,pl}.json` under
  `household_app.*`, one file per language of the shared language switcher.
  The moved dashboard strings still come from the shared `@alfheim/shared`
  dictionaries. `src/i18n/tests` fails on any key literal that does not
  resolve in all three languages, on `t()` keys built at runtime, and on
  missing keys, placeholder mismatches or untranslated Polish copies.
- **Errors:** `describeApiError` (`src/lib/apiErrors.ts`) shows the backend's
  `message` (also `{detail}` / `{detail: {message}}` bodies) inside a
  translated wrapper; 401, 403 and 404 keep their dedicated texts.
- **Map popups:** the shared `OSMMapViewer` renders `popupContent` as HTML, so
  build it with `escapeHtml` (`src/lib/html.ts`).
