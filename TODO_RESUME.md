# Resume point (workout frontend)

Commit: `6009caf` — WIP, not verified end-to-end.

## Done
- Backend (committed, tested, green) — see commits 991f0dd/d1ac27c/62e530e/4ffcff4
- Shared package primitives + i18n + HouseholdSwitcher fix (4ffcff4)
- Frontend scaffold + equipment/exercises/analytics/session/offline_sync slices (6009caf)

## Next steps
1. `cd apps/workout/frontend && pnpm exec tsc --noEmit` — was clean as of last check, re-verify after any edits.
2. `pnpm test` — known issues at time of pause:
   - `offline_sync` tests were timing out (fake-indexeddb + vitest interaction, not yet root-caused — likely test isolation/contention from parallel agent runs, retest in isolation first).
   - equipment POST/PATCH/DELETE MSW handlers were added late (see `src/tests/mocks/handlers.ts`) — rerun `equipmentApi.test.ts` to confirm they're picked up.
3. `plans` slice not started — mirror `equipment` (api/hooks/components), backend contract in `apps/workout/backend/src/features/plans/`. Needs nested day/exercise/set builder UI + read of `/resolved` endpoint (never recompute weight engine client-side).
4. Infra wiring not started: Caddyfile redir+handle blocks, Keycloak `workout-frontend` client, `apps/workout/compose.yml` frontend service + `.env.example`, `scripts/up.sh` stage, dashboard tier1_core_registry.go entry.
5. Final quality gates: `pnpm -r exec tsc --noEmit`, `pnpm -r test`, `./scripts/verify.sh --frontend`, docs update, delete this file.

Full plan: `/Users/leifkroeger/.claude/plans/task-architecture-planning-purrfect-lollipop.md`
