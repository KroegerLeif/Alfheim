package bootstrap

import (
	"context"
	"errors"
	"fmt"
)

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
