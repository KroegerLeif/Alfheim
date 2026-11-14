package app

import (
	"context"
	"flag"
	"fmt"
	"io"

	"alfheim/installer/internal/features/provisioning"
	"alfheim/installer/internal/features/zitadelauth"
	"alfheim/installer/internal/shared/envfile"
)

// zitadelTokenUsage documents the `zitadel-token` subcommand, the
// replacement for reading the never-expiring bootstrap PAT out of .env when
// an operator or developer calls Zitadel's APIs by hand (issue #789).
const zitadelTokenUsage = `alfheim-setup zitadel-token - print a short-lived Zitadel API access token

Usage:
  alfheim-setup zitadel-token --env-file PATH
                              [--zitadel-url URL] [--zitadel-tls-addr HOST:PORT] [--ca-file PATH]

Exchanges the stored machine key of the provisioning machine user
(infrastructure/zitadel/provisioner/machine-key.json next to the .env) for an
access token and prints it on stdout. The token expires after Zitadel's
access token lifetime (12 hours by default). It carries IAM owner rights:
keep it in a shell variable and never write it to a file. The key is not
rotated; the next provision or update run does that.

Flags:
  --env-file PATH      The installation's .env.
  --zitadel-url URL    Caddy's plain-HTTP listener, used only when
                       ZITADEL_EXTERNALSECURE is not true.
                       Default: http://127.0.0.1:80.
  --zitadel-tls-addr HOST:PORT
                       Caddy's HTTPS listener. Default: 127.0.0.1:443.
  --ca-file PATH       Root CA trusted in addition to the system roots.

Exit codes:
  0 success   1 failure   2 usage error
`

// RunZitadelToken implements the `zitadel-token` subcommand.
func RunZitadelToken(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("alfheim-setup zitadel-token", flag.ContinueOnError)
	fs.SetOutput(stderr)
	fs.Usage = func() { fmt.Fprint(stderr, zitadelTokenUsage) }
	envFile := fs.String("env-file", "", "path to the .env file")
	zitadelURL := fs.String("zitadel-url", provisioning.DefaultPlainURL, "Caddy's plain-HTTP base URL")
	tlsAddr := fs.String("zitadel-tls-addr", provisioning.DefaultTLSAddr, "Caddy's HTTPS listener address")
	caFile := fs.String("ca-file", "", "extra root CA to trust")
	if err := fs.Parse(args); err != nil {
		return ExitUsage
	}
	if fs.NArg() > 0 || *envFile == "" {
		fmt.Fprintln(stderr, "Error: --env-file is required and no positional arguments are accepted")
		fmt.Fprint(stderr, zitadelTokenUsage)
		return ExitUsage
	}

	existing, err := envfile.ParseFile(*envFile)
	if err != nil {
		fmt.Fprintf(stderr, "Error: read %s: %v\n", *envFile, err)
		return ExitFailure
	}
	target, err := resolveZitadelTarget(*envFile, existing, zitadelEndpointFlags{*zitadelURL, *tlsAddr, *caFile})
	if err != nil {
		fmt.Fprintf(stderr, "Error: %v\n", err)
		return ExitFailure
	}
	keyFile := target.layout.ZitadelProvisionerKeyFile()
	key, found, err := zitadelauth.LoadKey(keyFile)
	if err != nil {
		fmt.Fprintf(stderr, "Error: %v\n", err)
		return ExitFailure
	}
	if !found {
		fmt.Fprintf(stderr, "Error: no Zitadel machine key at %s; run alfheim-setup provision or update first\n", keyFile)
		return ExitFailure
	}
	token, err := newTokenExchanger(target.client, target.issuer, nil).Exchange(context.Background(), key)
	if err != nil {
		fmt.Fprintf(stderr, "Error: %v\n", err)
		return ExitFailure
	}
	fmt.Fprintln(stdout, token)
	return ExitOK
}
