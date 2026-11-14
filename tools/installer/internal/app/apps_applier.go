package app

import (
	"context"

	"alfheim/installer/internal/features/apps"
)

// AppOrchestrator is the part of the compose orchestrator the apps command
// needs. It is an interface so tests never start a container.
type AppOrchestrator interface {
	EnsureDatabases(ctx context.Context) error
	StartServices(ctx context.Context, services []string) error
	WaitContainers(ctx context.Context, containers []string) error
	RemoveServices(ctx context.Context, services []string) error
	RestartIngress(ctx context.Context) error
}

// IngressRenderer re-renders the Caddyfile for the set now stored in .env
// and reports whether its content changed.
type IngressRenderer func() (bool, error)

// composeApplier implements apps.Applier on top of the compose orchestrator.
type composeApplier struct {
	orch   AppOrchestrator
	render IngressRenderer
}

// Enable creates any missing database, starts the app, waits for its
// containers and then routes it in Caddy.
func (c composeApplier) Enable(ctx context.Context, app apps.App, _ apps.Set) error {
	if err := c.orch.EnsureDatabases(ctx); err != nil {
		return err
	}
	if err := c.orch.StartServices(ctx, app.Services); err != nil {
		return err
	}
	if err := c.orch.WaitContainers(ctx, app.ContainerNames()); err != nil {
		return err
	}
	return c.reloadIngress(ctx)
}

// Disable stops and removes the app's containers, keeping its data, and
// replaces its routes with a 404 and a redirect to the dashboard.
func (c composeApplier) Disable(ctx context.Context, app apps.App, _ apps.Set) error {
	if err := c.orch.RemoveServices(ctx, app.Services); err != nil {
		return err
	}
	return c.reloadIngress(ctx)
}

// reloadIngress re-renders the Caddyfile and restarts Caddy when it changed.
func (c composeApplier) reloadIngress(ctx context.Context) error {
	changed, err := c.render()
	if err != nil {
		return err
	}
	if !changed {
		return nil
	}
	return c.orch.RestartIngress(ctx)
}
