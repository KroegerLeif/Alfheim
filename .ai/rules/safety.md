# Runtime Safety & Guards (`.ai/rules/safety.md`)

This document defines repository-wide safety guards to prevent Next.js page crashes, runtime errors, and OIDC redirection hydration mismatches.

---

## 🛡️ Rule 1: Array Null-Safety Guards

Hydration mismatches and raw exceptions from API response shifts can crash page views. Ensure execution frames are protected by the following checks:

### 1. Array Null-Safety Fallbacks
* Array responses returned from REST queries or passed through component properties **MUST** be explicitly coalesced to empty arrays (`?? []`) before accessing `.length`, `.map()`, `.join()`, or other array prototype operations:
  ```typescript
  // Safeguard queries
  const contacts = queryData ?? [];

  // Safeguard array property join/map calls
  const links = contact?.links ?? [];
  return links.map(link => ...);
  ```
* Checking array presence (`contacts && contacts.length > 0`) is **insufficient** if the payload resolves to `null`, since `null && null.length > 0` returns `null`, which throws React hydration mismatches or leads to uncaught runtime exceptions in rendering logic.

---

## 🔄 Rule 2: Next.js 15+ Route Parameters Promise Unwrap

In Next.js 15+, dynamic route parameters (`params` and `searchParams`) are asynchronous **Promises** and must be resolved before consumption.

### 1. Asynchronous params Resolution
* Always resolve route parameter properties asynchronously inside Server Components:
  ```typescript
  export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <FeatureView id={id} />;
  }
  ```
* Wrap dynamic views inside a React `<Suspense>` boundary to allow clean stream hydration.
