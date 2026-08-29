# Library Frontend Microfrontend

Next.js 16 (App Router) microfrontend for the Alfheim Media & Library application (`apps/library/frontend`).

## 🛠️ Stack & Architecture

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS, Shadcn/UI, `@alfheim/shared` components
- **Routing & Proxy**: `src/proxy.ts` (Next.js 16 proxy pattern for locale handling and authentication)
- **API Client**: `ky` HTTP client configured with bearer token and `X-Household-ID` header propagation

## 🌐 Ingress Routing

- **Base Path**: `/library`
- **Supported Locales**: `en` (default), `de`, `pl`
- **Gateway Endpoint**: Proxied via Caddy gateway at `http://alfheim.loegien.localhost/library`.

## ⚙️ Environment Variables

- `NEXT_PUBLIC_LIBRARY_API_URL`: Backend API Gateway URL (defaults to `http://api.alfheim.loegien.localhost/api/v1/library`).
- `NEXT_PUBLIC_KEYCLOAK_URL`: Public Keycloak URL for auth redirect flows.
- `NEXT_PUBLIC_FRONTEND_URL`: Primary MFE root URL.

## 🧪 Local Run & Testing

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run Vitest test suite
pnpm test

# TypeScript type check
pnpm check-types
```
