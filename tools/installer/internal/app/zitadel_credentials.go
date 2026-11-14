package app

import (
	"context"
	"fmt"
	"strings"
	"time"

	"alfheim/installer/internal/features/provisioning"
	"alfheim/installer/internal/features/zitadelauth"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
)

// bootstrapPATEnvKey is the legacy .env copy of Zitadel's first-instance
// PAT. It only ever holds a value until the first run that migrates to the
// machine key (issue #789), and as a one-off recovery input.
const bootstrapPATEnvKey = "ZITADEL_BOOTSTRAP_PAT"

// zitadelCredentials is what one run needs to authenticate to Zitadel.
type zitadelCredentials struct {
	// client reaches Zitadel through Caddy; its token is replaced.
	client *provisioning.HTTPClient
	// issuer is Zitadel's issuer URL, the machine key assertion's audience.
	issuer string
	// layout locates the stored machine key, Zitadel's PAT file and .env.
	layout paths.Layout
	// existing is the .env as read before this run.
	existing map[string]string
	// bootstrap supplies a PAT when no stored machine key works.
	bootstrap zitadelauth.BootstrapFunc
	// sleep is injectable for tests; nil uses a real sleep.
	sleep func(ctx context.Context, d time.Duration) error
}

// authenticateZitadel returns a copy of c.client that carries a short-lived
// access token from the rotated machine key, plus non-fatal warnings. Every
// local copy of the bootstrap PAT is retired afterwards; Zitadel has already
// revoked it, so nothing in .env stays a valid credential.
func authenticateZitadel(ctx context.Context, c zitadelCredentials) (*provisioning.HTTPClient, []string, error) {
	manager := zitadelauth.Manager{
		KeyFile:   c.layout.ZitadelProvisionerKeyFile(),
		Exchanger: newTokenExchanger(c.client, c.issuer, c.sleep),
		Admin:     func(token string) zitadelauth.Admin { return c.client.WithToken(token) },
		Sleep:     c.sleep,
	}
	session, err := manager.Acquire(ctx, c.bootstrap)
	if err != nil {
		return nil, nil, err
	}
	warnings, err := retireBootstrapPAT(c.layout, c.existing)
	if err != nil {
		return nil, nil, err
	}
	return c.client.WithToken(session.Token), append(session.Warnings, warnings...), nil
}

// newTokenExchanger builds the JWT profile exchanger for the same endpoint
// and transport the Management API client uses.
func newTokenExchanger(
	client *provisioning.HTTPClient, issuer string, sleep func(ctx context.Context, d time.Duration) error,
) zitadelauth.Exchanger {
	return zitadelauth.Exchanger{
		BaseURL:  client.BaseURL,
		Host:     client.Host,
		Audience: issuer,
		HTTP:     client.HTTP,
		Sleep:    sleep,
	}
}

// retireBootstrapPAT clears ZITADEL_BOOTSTRAP_PAT in .env and deletes the
// PAT file Zitadel wrote on first init. Failing to clear .env is an error,
// since .env must not keep a credential; a PAT file that cannot be deleted
// (the machinekey directory belongs to Zitadel's container user) is only a
// warning, because the token in it is already revoked.
func retireBootstrapPAT(layout paths.Layout, existing map[string]string) ([]string, error) {
	if strings.TrimSpace(existing[bootstrapPATEnvKey]) != "" {
		if err := envfile.Update(layout.EnvFile(), map[string]string{bootstrapPATEnvKey: ""}); err != nil {
			return nil, fmt.Errorf("alfheim-setup: clear the revoked %s from .env: %w", bootstrapPATEnvKey, err)
		}
	}
	if err := zitadelauth.RemoveIfExists(layout.ZitadelPATFile()); err != nil {
		return []string{fmt.Sprintf(
			"The bootstrap PAT is revoked in Zitadel, but its file could not be deleted: %v. Delete %s by hand.",
			err, layout.ZitadelPATFile())}, nil
	}
	return nil, nil
}
