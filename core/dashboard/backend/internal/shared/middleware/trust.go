package middleware

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
)

// extraCAFileEnv names a PEM bundle of extra root certificates to trust for
// calls to the OIDC issuer. Installs using a private root CA (--tls internal)
// serve the issuer with a certificate the system store does not know.
const extraCAFileEnv = "ALFHEIM_EXTRA_CA_FILE"

// extraCATransport returns an HTTP transport that trusts the system roots plus
// the certificates in ALFHEIM_EXTRA_CA_FILE. It returns nil when the variable is
// unset or blank so callers keep Go's default transport unchanged. A set but
// unreadable or invalid file is an error: failing at startup is clearer than an
// opaque "certificate signed by unknown authority" on every request.
func extraCATransport() (http.RoundTripper, error) {
	caFile := strings.TrimSpace(os.Getenv(extraCAFileEnv))
	if caFile == "" {
		return nil, nil
	}

	pem, err := os.ReadFile(caFile) // #nosec G304 -- operator-provided path
	if err != nil {
		return nil, fmt.Errorf("%s=%q could not be read: %w", extraCAFileEnv, caFile, err)
	}

	pool, err := x509.SystemCertPool()
	if err != nil {
		return nil, fmt.Errorf("failed to load system cert pool: %w", err)
	}
	// Extra roots are added to the system pool, never replacing it.
	if !pool.AppendCertsFromPEM(pem) {
		return nil, errors.New(extraCAFileEnv + "=" + caFile + " contains no valid PEM certificates")
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}
	return transport, nil
}
