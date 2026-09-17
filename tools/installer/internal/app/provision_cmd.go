package app

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"alfheim/installer/internal/features/provisioning"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
)

// provisionUsage documents the hidden `provision` subcommand, which exists so
// scripts/up.sh can reuse the same Zitadel reconciliation logic as the
// interactive installer instead of shelling out to a separate script.
const provisionUsage = `alfheim-setup provision - reconcile Zitadel OIDC clients for an existing .env

Usage:
  alfheim-setup provision --env-file PATH --pat-file PATH
                          [--zitadel-url URL] [--zitadel-tls-addr HOST:PORT] [--ca-file PATH]

Flags:
  --env-file PATH      The .env to read (for ZITADEL_EXTERNALDOMAIN,
                       ALFHEIM_BASE_URL, ZITADEL_EXTERNALSECURE and any
                       previously provisioned credentials) and update in place.
  --pat-file PATH      The Zitadel bootstrap machine user's personal access
                       token file (ZITADEL_FIRSTINSTANCE_PATPATH).
  --zitadel-url URL    Caddy's plain-HTTP listener, used only when
                       ZITADEL_EXTERNALSECURE is not true.
                       Default: http://127.0.0.1:80.
  --zitadel-tls-addr HOST:PORT
                       Caddy's HTTPS listener, dialled for a secure install
                       while requests name https://<ZITADEL_EXTERNALDOMAIN>.
                       Default: 127.0.0.1:443.
  --ca-file PATH       Root CA trusted in addition to the system roots.
                       Default: infrastructure/ca/alfheim-root-ca.crt next to
                       the .env, when it exists.

Exit codes:
  0 success   1 failure   2 usage error
`

// RunProvision implements the `provision` subcommand: it reconciles the
// Alfheim project and OIDC applications against an existing .env and PAT
// file, without running the wizard or touching any container. It is the
// shared implementation behind both a fresh install's runBootstrap step and
// scripts/up.sh, which invokes it via `go run ./cmd/alfheim-setup provision`.
func RunProvision(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("alfheim-setup provision", flag.ContinueOnError)
	fs.SetOutput(stderr)
	fs.Usage = func() { fmt.Fprint(stderr, provisionUsage) }

	envFile := fs.String("env-file", "", "path to the .env file to read and update")
	patFile := fs.String("pat-file", "", "path to the Zitadel bootstrap PAT file")
	zitadelURL := fs.String("zitadel-url", provisioning.DefaultPlainURL, "Caddy's plain-HTTP base URL")
	tlsAddr := fs.String("zitadel-tls-addr", provisioning.DefaultTLSAddr, "Caddy's HTTPS listener address")
	caFile := fs.String("ca-file", "", "extra root CA to trust")

	if err := fs.Parse(args); err != nil {
		return ExitUsage
	}
	if fs.NArg() > 0 {
		fmt.Fprint(stderr, provisionUsage)
		return ExitUsage
	}
	if *envFile == "" || *patFile == "" {
		fmt.Fprintln(stderr, "Error: --env-file and --pat-file are required")
		fmt.Fprint(stderr, provisionUsage)
		return ExitUsage
	}

	existing, err := envfile.ParseFile(*envFile)
	if err != nil {
		fmt.Fprintf(stderr, "Error: read %s: %v\n", *envFile, err)
		return ExitFailure
	}

	authHost := existing["ZITADEL_EXTERNALDOMAIN"]
	baseURL := existing["ALFHEIM_BASE_URL"]
	if authHost == "" || baseURL == "" {
		fmt.Fprintf(stderr,
			"Error: %s is missing ZITADEL_EXTERNALDOMAIN or ALFHEIM_BASE_URL\n", *envFile)
		return ExitFailure
	}
	secure := existing["ZITADEL_EXTERNALSECURE"] == "true"

	patBytes, err := os.ReadFile(*patFile)
	if err != nil {
		fmt.Fprintf(stderr, "Error: read PAT file %s: %v\n", *patFile, err)
		return ExitFailure
	}
	pat := strings.TrimSpace(string(patBytes))
	if pat == "" {
		fmt.Fprintf(stderr, "Error: %s is empty\n", *patFile)
		return ExitFailure
	}

	rootCA := *caFile
	if rootCA == "" {
		rootCA = existingRootCA(paths.Layout{Root: filepath.Dir(*envFile)})
	}
	endpointURL, httpClient, err := provisioning.Endpoint{
		Secure:          secure,
		AuthHost:        authHost,
		PlainURL:        *zitadelURL,
		TLSAddr:         *tlsAddr,
		ExtraRootCAFile: rootCA,
	}.Client()
	if err != nil {
		fmt.Fprintf(stderr, "Error: %v\n", err)
		return ExitFailure
	}
	client := &provisioning.HTTPClient{BaseURL: endpointURL, Host: authHost, PAT: pat, HTTP: httpClient}
	in := provisioning.BuildInput(defaultProjectName, baseURL, !secure, provisioning.AppSlugs)

	result, err := provisioning.Provision(context.Background(), client, in, existing)
	if err != nil {
		fmt.Fprintf(stderr, "Error: provision Zitadel: %v\n", err)
		return ExitFailure
	}

	if err := envfile.Update(*envFile, map[string]string{
		"ZITADEL_PROJECT_ID":         result.ProjectID,
		"OIDC_AUDIENCE":              result.ProjectID,
		"ALFHEIM_WEB_CLIENT_ID":      result.WebClientID,
		"GRAFANA_OIDC_CLIENT_ID":     result.GrafanaClientID,
		"GRAFANA_OIDC_CLIENT_SECRET": result.GrafanaSecret,
	}); err != nil {
		fmt.Fprintf(stderr, "Error: write %s: %v\n", *envFile, err)
		return ExitFailure
	}

	fmt.Fprintf(stdout, "Zitadel OIDC clients are provisioned.\n  GRAFANA_OIDC_CLIENT_ID=%s\n",
		result.GrafanaClientID)
	return ExitOK
}
