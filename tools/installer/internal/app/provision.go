package app

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/features/provisioning"
	"alfheim/installer/internal/shared/envfile"
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
// A secure install is reached as https://<auth host> dialled to Caddy's
// loopback HTTPS listener (see provisioning.Endpoint), trusting the system
// roots plus the installation's generated root CA when one exists.
type DefaultProvisioner struct {
	// BaseURL is Caddy's plain-HTTP listener, used only for an insecure
	// (legacy) .env. Defaults to http://127.0.0.1:80.
	BaseURL string
	// TLSAddr is Caddy's HTTPS listener for a secure install. Defaults to
	// 127.0.0.1:443.
	TLSAddr string
	// RootCAFile is trusted in addition to the system roots. Defaults to the
	// layout's generated root CA copy, when that file exists.
	RootCAFile string
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

	// The PAT file only exists while Zitadel's first instance is created, so
	// once we have a PAT — from the file or from .env — persist it into .env
	// (issue #452, fact I). That is what lets a later run, against an
	// already-initialised Zitadel whose machinekey volume was lost, still
	// find it. Only write when it actually changed, so a plain re-run does
	// not touch .env for no reason.
	if pat != strings.TrimSpace(existing["ZITADEL_BOOTSTRAP_PAT"]) {
		if err := envfile.Update(layout.EnvFile(), map[string]string{"ZITADEL_BOOTSTRAP_PAT": pat}); err != nil {
			return provisioning.Result{}, fmt.Errorf("alfheim-setup: store the Zitadel bootstrap PAT: %w", err)
		}
	}

	baseURL, httpClient, err := provisioning.Endpoint{
		Secure:          on.Secure,
		AuthHost:        on.AuthHost,
		PlainURL:        p.baseURL(),
		TLSAddr:         p.TLSAddr,
		ExtraRootCAFile: p.rootCAFile(layout),
	}.Client()
	if err != nil {
		return provisioning.Result{}, err
	}
	client := &provisioning.HTTPClient{
		BaseURL: baseURL,
		Host:    on.AuthHost,
		PAT:     pat,
		HTTP:    httpClient,
	}
	in := provisioning.BuildInput(defaultProjectName, on.BaseURL, !on.Secure, provisioning.AppSlugs)
	result, err := provisioning.Provision(ctx, client, in, existing)
	if err != nil {
		if provisioning.IsUnauthorized(err) {
			return provisioning.Result{}, fmt.Errorf(
				"alfheim-setup: Zitadel rejected the bootstrap PAT: it likely does not belong to "+
					"this Zitadel instance — check %s for a PAT left over from an earlier install: %w",
				layout.ZitadelPATFile(), err)
		}
		return provisioning.Result{}, err
	}
	return result, nil
}

// defaultProjectName is the Zitadel project every OIDC application lives
// under, matching scripts/zitadel-bootstrap.sh's PROJECT_NAME.
const defaultProjectName = "Alfheim"

func (p *DefaultProvisioner) baseURL() string {
	if p.BaseURL != "" {
		return p.BaseURL
	}
	return provisioning.DefaultPlainURL
}

func (p *DefaultProvisioner) rootCAFile(layout paths.Layout) string {
	if p.RootCAFile != "" {
		return p.RootCAFile
	}
	return existingRootCA(layout)
}

// existingRootCA returns the installation's generated root CA copy, or ""
// when this install has none (a strategy with a publicly trusted
// certificate). Trusting our own root is harmless for those, but a missing
// file must not fail provisioning.
func existingRootCA(layout paths.Layout) string {
	path := layout.TrustedCARootCert()
	if info, err := os.Stat(path); err == nil && !info.IsDir() {
		return path
	}
	return ""
}

// readPAT resolves the bootstrap machine user's personal access token.
//
// Order matters: the PAT file only exists while Zitadel's first instance is
// created, so on an update against an already-initialised Zitadel (or one
// whose machinekey volume was lost) it never reappears — blocking the whole
// 60s timeout waiting for a file that will never come back would make every
// Day-2 run that slow. So a file present right now wins immediately (the
// common case: fresh install, first boot); failing that, a copy already
// stored in .env from an earlier run wins immediately too; only when neither
// is available yet do we actually wait for the file, up to the timeout —
// this covers the fresh-install race where Zitadel's healthcheck can turn
// green a moment before the PAT file lands on disk.
func (p *DefaultProvisioner) readPAT(
	ctx context.Context, layout paths.Layout, existing map[string]string,
) (string, error) {
	if pat := readPATFileOnce(layout); pat != "" {
		return pat, nil
	}
	if pat := strings.TrimSpace(existing["ZITADEL_BOOTSTRAP_PAT"]); pat != "" {
		return pat, nil
	}

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
		if !time.Now().Before(deadline) {
			break
		}
		if err := sleep(ctx, time.Second); err != nil {
			return "", err
		}
		if pat := readPATFileOnce(layout); pat != "" {
			return pat, nil
		}
	}

	return "", fmt.Errorf(
		"alfheim-setup: Zitadel never wrote a bootstrap PAT to %s, and none is stored in .env "+
			"(ZITADEL_BOOTSTRAP_PAT); it is only written while the first instance is created",
		layout.ZitadelPATFile())
}

// readPATFileOnce reads the PAT file without waiting, returning "" when it
// is absent or empty.
func readPATFileOnce(layout paths.Layout) string {
	content, err := os.ReadFile(layout.ZitadelPATFile())
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(content))
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
