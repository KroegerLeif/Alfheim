package app

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/features/provisioning"
	"alfheim/installer/internal/shared/paths"
)

// Provisioner reconciles the Zitadel project and OIDC applications a fresh
// install needs, so the dashboard, every app frontend and Grafana can log in
// without a manual step in the Zitadel console. It is an interface so tests
// can substitute a fake that skips the PAT wait and the network call.
type Provisioner interface {
	Provision(
		ctx context.Context, layout paths.Layout, on onboarding.Config, existing map[string]string,
	) (provisioning.Result, error)
}

// DefaultProvisioner talks to Zitadel through Caddy, the same way scripts/up.sh's
// `provision` subcommand does: Zitadel resolves the instance by Host header,
// so every request targets Caddy's own listener on the loopback interface.
type DefaultProvisioner struct {
	// BaseURL is where Caddy listens. Defaults to http://127.0.0.1:80.
	BaseURL string
	// PATWaitTimeout bounds how long to wait for Zitadel to write the
	// bootstrap PAT on first init. Defaults to 60s.
	PATWaitTimeout time.Duration
	// Sleep is injectable for tests; defaults to a real, context-aware sleep.
	Sleep func(ctx context.Context, d time.Duration) error
}

// Provision implements Provisioner.
func (p *DefaultProvisioner) Provision(
	ctx context.Context, layout paths.Layout, on onboarding.Config, existing map[string]string,
) (provisioning.Result, error) {
	pat, err := p.readPAT(ctx, layout, existing)
	if err != nil {
		return provisioning.Result{}, err
	}

	client := &provisioning.HTTPClient{
		BaseURL: p.baseURL(),
		Host:    on.AuthHost,
		PAT:     pat,
	}
	in := provisioning.BuildInput(defaultProjectName, on.BaseURL, !on.Secure, provisioning.AppSlugs)
	return provisioning.Provision(ctx, client, in, existing)
}

// defaultProjectName is the Zitadel project every OIDC application lives
// under, matching scripts/zitadel-bootstrap.sh's PROJECT_NAME.
const defaultProjectName = "Alfheim"

func (p *DefaultProvisioner) baseURL() string {
	if p.BaseURL != "" {
		return p.BaseURL
	}
	return "http://127.0.0.1:80"
}

// readPAT waits for Zitadel to write the bootstrap machine user's personal
// access token, then falls back to a copy the installer stored in .env on an
// earlier run — the file is only written while the *first* instance is
// created, so a re-run against an already-initialised Zitadel has no other
// source for it.
func (p *DefaultProvisioner) readPAT(
	ctx context.Context, layout paths.Layout, existing map[string]string,
) (string, error) {
	timeout := p.PATWaitTimeout
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	sleep := p.Sleep
	if sleep == nil {
		sleep = realSleep
	}

	deadline := time.Now().Add(timeout)
	for {
		if content, err := os.ReadFile(layout.ZitadelPATFile()); err == nil {
			if pat := strings.TrimSpace(string(content)); pat != "" {
				return pat, nil
			}
		}
		if !time.Now().Before(deadline) {
			break
		}
		if err := sleep(ctx, time.Second); err != nil {
			return "", err
		}
	}

	if pat := strings.TrimSpace(existing["ZITADEL_BOOTSTRAP_PAT"]); pat != "" {
		return pat, nil
	}
	return "", fmt.Errorf(
		"alfheim-setup: Zitadel never wrote a bootstrap PAT to %s, and none is stored in .env "+
			"(ZITADEL_BOOTSTRAP_PAT); it is only written while the first instance is created",
		layout.ZitadelPATFile())
}

// realSleep waits for d, or returns early when ctx is cancelled.
func realSleep(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
