package apps

import (
	"context"
	"fmt"
	"io"
)

// Applier brings the running containers in line with a changed set. It is
// implemented by the composition root on top of the compose orchestrator, so
// this package never starts a container itself.
type Applier interface {
	// Enable starts app, which set now contains.
	Enable(ctx context.Context, app App, set Set) error
	// Disable stops and removes app's containers, which set no longer
	// contains. It must never remove volumes or databases.
	Disable(ctx context.Context, app App, set Set) error
}

// Status is one row of `apps list`.
type Status struct {
	App     App
	Enabled bool
}

// Service implements the `apps` subcommand: it reads the enabled set from
// the Store, applies a change through the Applier and records the result.
type Service struct {
	Store   Store
	Applier Applier
	Out     io.Writer
}

// List returns every catalog app with its state.
func (s *Service) List() ([]Status, error) {
	set, err := s.load()
	if err != nil {
		return nil, err
	}
	out := make([]Status, 0, len(catalog))
	for _, a := range catalog {
		out = append(out, Status{App: a, Enabled: set.Has(a.Name)})
	}
	return out, nil
}

// Enable switches name on: it records the new set in .env first, so a failed
// start is retried by the next run, then starts the app.
func (s *Service) Enable(ctx context.Context, name string) error {
	current, err := s.load()
	if err != nil {
		return err
	}
	next, err := Enable(current, name)
	if err != nil {
		return err
	}
	if current.Has(name) {
		fmt.Fprintf(s.Out, "%s is already enabled.\n", name)
		return nil
	}
	if err := s.Store.Update(EnvValues(next, name == Telemetry)); err != nil {
		return fmt.Errorf("apps: record enabled apps: %w", err)
	}
	app, _ := Lookup(name) // Enable above already rejected an unknown name.
	if err := s.Applier.Enable(ctx, app, next); err != nil {
		return fmt.Errorf("apps: start %s: %w", name, err)
	}
	fmt.Fprintf(s.Out, "Enabled %s.\n", name)
	return nil
}

// Disable switches name off: it records the new set, then stops and removes
// the app's containers. Volumes and databases are always kept.
func (s *Service) Disable(ctx context.Context, name string) error {
	current, err := s.load()
	if err != nil {
		return err
	}
	next, err := Disable(current, name)
	if err != nil {
		return err
	}
	if !current.Has(name) {
		fmt.Fprintf(s.Out, "%s is already disabled.\n", name)
		return nil
	}
	if err := s.Store.Update(EnvValues(next, name == Telemetry)); err != nil {
		return fmt.Errorf("apps: record enabled apps: %w", err)
	}
	app, _ := Lookup(name) // Disable above already rejected an unknown name.
	if err := s.Applier.Disable(ctx, app, next); err != nil {
		return fmt.Errorf("apps: stop %s: %w", name, err)
	}
	fmt.Fprintf(s.Out, "Disabled %s. Its containers were stopped and removed; "+
		"its volumes and database were kept, so `alfheim-setup apps enable %s` brings its data back.\n",
		name, name)
	return nil
}

// load reads the enabled set from the Store.
func (s *Service) load() (Set, error) {
	env, err := s.Store.Load()
	if err != nil {
		return Set{}, fmt.Errorf("apps: read .env: %w", err)
	}
	return Enabled(env)
}
