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
	RecreateServices(ctx context.Context, services []string) error
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
// containers, routes it in Caddy and refreshes the backends that list it.
func (c composeApplier) Enable(ctx context.Context, app apps.App, set apps.Set) error {
	if err := c.orch.EnsureDatabases(ctx); err != nil {
		return err
	}
	if err := c.orch.StartServices(ctx, app.Services); err != nil {
		return err
	}
	if err := c.orch.WaitContainers(ctx, app.ContainerNames()); err != nil {
		return err
	}
	if err := c.reloadIngress(ctx); err != nil {
		return err
	}
	return c.refreshConsumers(ctx, app, set)
}

// Disable stops and removes the app's containers, keeping its data, replaces
// its routes with a 404 and a redirect to the dashboard, and refreshes the
// backends that listed it.
func (c composeApplier) Disable(ctx context.Context, app apps.App, set apps.Set) error {
	if err := c.orch.RemoveServices(ctx, app.Services); err != nil {
		return err
	}
	if err := c.reloadIngress(ctx); err != nil {
		return err
	}
	return c.refreshConsumers(ctx, app, set)
}

// refreshConsumers recreates the running backends that read the enabled set
// from .env when their container is created (#922): dashboard-backend
// (ALFHEIM_ENABLED_APPS: the tiles) and, while chat is enabled,
// chat-backend (CHAT_MCP_SERVERS: the tools). A plain restart would keep the
// old environment, so the containers are recreated, then waited on.
func (c composeApplier) refreshConsumers(ctx context.Context, changed apps.App, set apps.Set) error {
	services := apps.EnabledSetConsumers(changed, set)
	if err := c.orch.RecreateServices(ctx, services); err != nil {
		return err
	}
	return c.orch.WaitContainers(ctx, services)
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
