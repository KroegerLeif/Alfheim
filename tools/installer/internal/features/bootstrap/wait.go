package bootstrap

import (
	"context"
	"fmt"
	"strings"
	"time"

	"alfheim/installer/internal/shared/runner"
)

// pollInterval is how often container health is sampled.
const pollInterval = 3 * time.Second

// clock abstracts time so the timeout path is testable without real waiting.
type clock interface {
	Now() time.Time
	Sleep(ctx context.Context, d time.Duration) error
}

// realClock is the production clock.
type realClock struct{}

func (realClock) Now() time.Time { return time.Now() }

// Sleep waits for d, or returns early when ctx is cancelled.
func (realClock) Sleep(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// healthState is the normalised status of a container.
type healthState int

const (
	healthPending healthState = iota
	healthReady
	healthFailed
)

// waitHealthy blocks until the target reports healthy, or fails.
//
// A container without a healthcheck is considered ready as soon as it runs,
// which matches how the previous shell installer behaved.
func (o *Orchestrator) waitHealthy(ctx context.Context, target HealthTarget) error {
	deadline := o.clock.Now().Add(target.Timeout)

	for {
		state, detail, err := o.probe(ctx, target.Container)
		if err != nil {
			return err
		}

		switch state {
		case healthReady:
			o.logf("  %s is ready", target.Label)
			return nil
		case healthFailed:
			return fmt.Errorf("bootstrap: %s failed to start (%s); inspect it with: docker logs %s",
				target.Label, detail, target.Container)
		}

		if !o.clock.Now().Before(deadline) {
			return fmt.Errorf("bootstrap: timed out after %s waiting for %s; inspect it with: docker logs %s",
				target.Timeout, target.Label, target.Container)
		}
		if err := o.clock.Sleep(ctx, pollInterval); err != nil {
			return err
		}
	}
}

// probe reports the current state of a container.
func (o *Orchestrator) probe(ctx context.Context, container string) (healthState, string, error) {
	res, err := o.runner.Run(ctx, runner.Command{
		Name: "docker",
		Args: []string{
			"inspect", "--format",
			"{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}",
			container,
		},
	})
	if err != nil {
		return healthPending, "", fmt.Errorf("bootstrap: inspect %s: %w", container, err)
	}
	// A container that has not been created yet is simply not ready.
	if res.ExitCode != 0 {
		return healthPending, "", nil
	}

	status, health, _ := strings.Cut(strings.TrimSpace(res.Stdout), "|")

	switch status {
	case "exited", "dead":
		return healthFailed, "container " + status, nil
	case "running":
		switch health {
		case "healthy", "none":
			return healthReady, "", nil
		case "unhealthy":
			return healthFailed, "healthcheck reported unhealthy", nil
		default:
			// "starting", or an empty value while Docker settles.
			return healthPending, health, nil
		}
	default:
		return healthPending, status, nil
	}
}
