# Budget Frontend Microfrontend

Next.js 16 (App Router) microfrontend for the Alfheim Budget & Treasury application (`apps/budget/frontend`).

## 🛠️ Tech Stack & Conventions

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Styling**: Tailwind CSS, Shadcn/UI, `@alfheim/shared` components
- **Routing & Proxy**: `src/proxy.ts` (Next.js 16 proxy pattern for locale handling and authentication)
- **API Client**: `ky` HTTP client with centralized bearer token and `X-Household-ID` header injection

## 🌐 Ingress Routing

- **Base Path**: `/budget`
- **Supported Locales**: `en` (default), `de`, `pl`
- **Gateway Endpoint**: Proxied via Caddy gateway at `http://alfheim.loegien.localhost/budget`.

## ⚙️ Environment Variables

- `NEXT_PUBLIC_BUDGET_API_URL`: Backend API Gateway URL (defaults to `http://api.alfheim.loegien.localhost/budget/api/v1`).
- `NEXT_PUBLIC_KEYCLOAK_URL`: Public Keycloak URL for authentication sessions.
- `NEXT_PUBLIC_FRONTEND_URL`: Primary MFE root URL.

## 🧪 Local Run & Quality Commands

```bash
# Install dependencies
pnpm install

# Run local development server
pnpm dev

# Run Vitest test suite
pnpm test

# TypeScript type check
pnpm check-types
```
