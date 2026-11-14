package app

import (
	"fmt"
	"io"

	"alfheim/installer/internal/features/apps"
	"alfheim/installer/internal/features/bootstrap"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
)

// newOrchestrator builds the compose orchestrator for an enabled set. It is
// the one place the set becomes COMPOSE_PROFILES for a compose invocation, so
// install, update, restore and the apps command start the same apps.
func newOrchestrator(r runner.Runner, layout paths.Layout, log io.Writer, set apps.Set) *bootstrap.Orchestrator {
	return bootstrap.New(r, layout, bootstrap.WithLogger(log), bootstrap.WithProfiles(set.Profiles()))
}

// loadEnabledApps reads the enabled set from the installation's .env.
func loadEnabledApps(layout paths.Layout) (apps.Set, error) {
	env, err := envfile.ParseFile(layout.EnvFile())
	if err != nil {
		return apps.Set{}, fmt.Errorf("alfheim-setup: read .env: %w", err)
	}
	return apps.Enabled(env)
}

// recordEnabledApps returns the set stored in env. An installation from
// before the Lean Core has no ALFHEIM_ENABLED_APPS; for it the key and
// COMPOSE_PROFILES are written with every app enabled, so a manual
// `docker compose up -d` keeps starting the whole stack it always ran. Such
// an installation always exported telemetry, so OTEL_ENABLED=true is written
// too unless the operator already set it.
func recordEnabledApps(stdout io.Writer, layout paths.Layout, env map[string]string) (apps.Set, error) {
	set, err := apps.Enabled(env)
	if err != nil {
		return apps.Set{}, err
	}
	if _, ok := env[apps.EnvKey]; ok {
		return set, nil
	}
	_, hasOTEL := env[apps.OTELEnabledKey]
	if err := envfile.Update(layout.EnvFile(), apps.EnvValues(set, !hasOTEL)); err != nil {
		return apps.Set{}, fmt.Errorf("alfheim-setup: record %s in .env: %w", apps.EnvKey, err)
	}
	fmt.Fprintf(stdout, "Recorded %s=%s (every app, as before) in .env\n", apps.EnvKey, set)
	return set, nil
}
