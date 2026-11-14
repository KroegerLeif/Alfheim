package app

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"alfheim/installer/internal/features/provisioning"
	"alfheim/installer/internal/features/zitadelauth"
	"alfheim/installer/internal/shared/paths"
)

// zitadelTarget is how the headless subcommands (`provision`,
// `zitadel-token`) reach Zitadel for an existing .env.
type zitadelTarget struct {
	// layout is rooted at the .env's directory.
	layout paths.Layout
	// client reaches Zitadel through Caddy, not yet authenticated.
	client *provisioning.HTTPClient
	// issuer is Zitadel's issuer URL (scheme and auth host).
	issuer string
	// baseURL is ALFHEIM_BASE_URL, the app's public origin.
	baseURL string
	// secure mirrors ZITADEL_EXTERNALSECURE.
	secure bool
}

// zitadelEndpointFlags are the connection flags shared by the headless
// subcommands.
type zitadelEndpointFlags struct {
	zitadelURL, tlsAddr, caFile string
}

// resolveZitadelTarget derives the Zitadel endpoint from an existing .env:
// the auth host, whether it is served over HTTPS, and which root CA to trust.
func resolveZitadelTarget(envFile string, existing map[string]string, f zitadelEndpointFlags) (zitadelTarget, error) {
	authHost := existing["ZITADEL_EXTERNALDOMAIN"]
	baseURL := existing["ALFHEIM_BASE_URL"]
	if authHost == "" || baseURL == "" {
		return zitadelTarget{}, fmt.Errorf("%s is missing ZITADEL_EXTERNALDOMAIN or ALFHEIM_BASE_URL", envFile)
	}
	secure := existing["ZITADEL_EXTERNALSECURE"] == "true"
	layout := paths.Layout{Root: filepath.Dir(envFile)}

	rootCA := f.caFile
	if rootCA == "" {
		rootCA = existingRootCA(layout)
	}
	endpointURL, httpClient, err := provisioning.Endpoint{
		Secure:          secure,
		AuthHost:        authHost,
		PlainURL:        f.zitadelURL,
		TLSAddr:         f.tlsAddr,
		ExtraRootCAFile: rootCA,
	}.Client()
	if err != nil {
		return zitadelTarget{}, err
	}
	return zitadelTarget{
		layout:  layout,
		client:  &provisioning.HTTPClient{BaseURL: endpointURL, Host: authHost, HTTP: httpClient},
		issuer:  zitadelIssuer(authHost, secure, existing["ZITADEL_EXTERNALPORT"]),
		baseURL: baseURL,
		secure:  secure,
	}, nil
}

// patFileBootstrap reads --pat-file for the `provision` subcommand. An empty
// path means none was given, which is fine as long as a machine key works.
func patFileBootstrap(patFile, keyFile string) (zitadelauth.BootstrapFunc, error) {
	if patFile == "" {
		return func(context.Context) (string, error) {
			return "", fmt.Errorf("no working Zitadel machine key at %s and no --pat-file given; "+
				"pass a personal access token of the provisioning machine user with --pat-file", keyFile)
		}, nil
	}
	content, err := os.ReadFile(patFile)
	if err != nil {
		return nil, fmt.Errorf("read PAT file %s: %w", patFile, err)
	}
	pat := strings.TrimSpace(string(content))
	if pat == "" {
		return nil, errors.New(patFile + " is empty")
	}
	return func(context.Context) (string, error) { return pat, nil }, nil
}

// zitadelIssuer is the issuer Zitadel puts into its tokens and expects as the
// audience of a JWT profile assertion: the auth origin, plus
// ZITADEL_EXTERNALPORT when that is not the scheme's default port.
func zitadelIssuer(authHost string, secure bool, port string) string {
	origin := authOrigin(authHost, secure)
	if port == "" || (secure && port == "443") || (!secure && port == "80") {
		return origin
	}
	return origin + ":" + port
}
