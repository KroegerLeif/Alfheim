package bootstrap

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// serviceTimeout bounds the wait for one container of an enabled app; it
// matches the slowest core backend in PhaseCoreStack.
const serviceTimeout = 240 * time.Second

// errNoServices guards against an empty service list, which compose would
// read as "every service" and so start or remove the whole stack.
var errNoServices = errors.New("bootstrap: no services given")

// StartServices pulls the images of services and starts them, for example
// when an optional app is enabled on a running installation.
func (o *Orchestrator) StartServices(ctx context.Context, services []string) error {
	if len(services) == 0 {
		return errNoServices
	}
	o.logf("Starting %v", services)
	if err := o.compose(ctx, append([]string{"pull"}, services...)); err != nil {
		return fmt.Errorf("bootstrap: pull images for %v: %w", services, err)
	}
	if err := o.compose(ctx, append([]string{"up", "-d"}, services...)); err != nil {
		return fmt.Errorf("bootstrap: start %v: %w", services, err)
	}
	return nil
}

// RecreateServices recreates the containers of services without touching
// their dependencies, so a container picks up a changed .env (compose only
// reads the environment when it creates a container).
func (o *Orchestrator) RecreateServices(ctx context.Context, services []string) error {
	if len(services) == 0 {
		return errNoServices
	}
	o.logf("Recreating %v to apply the changed app set", services)
	args := append([]string{"up", "-d", "--no-deps", "--force-recreate"}, services...)
	if err := o.compose(ctx, args); err != nil {
		return fmt.Errorf("bootstrap: recreate %v: %w", services, err)
	}
	return nil
}

// RemoveServices stops and removes the containers of services. It never
// passes -v, so named volumes and the data in postgres-core survive and a
// later StartServices brings the app back with its data.
func (o *Orchestrator) RemoveServices(ctx context.Context, services []string) error {
	if len(services) == 0 {
		return errNoServices
	}
	o.logf("Stopping and removing %v (volumes and databases are kept)", services)
	if err := o.compose(ctx, append([]string{"rm", "-s", "-f"}, services...)); err != nil {
		return fmt.Errorf("bootstrap: remove %v: %w", services, err)
	}
	return nil
}

// WaitContainers waits until every container reports healthy, or running
// when it has no healthcheck.
func (o *Orchestrator) WaitContainers(ctx context.Context, containers []string) error {
	for _, c := range containers {
		if err := o.waitHealthy(ctx, HealthTarget{Container: c, Label: c, Timeout: serviceTimeout}); err != nil {
			return err
		}
	}
	return nil
}
