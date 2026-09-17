package provisioning

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"
)

// Defaults for where Caddy is reached on the installation host.
const (
	// DefaultPlainURL is Caddy's plain-HTTP listener, used only for an
	// installation whose .env predates HTTPS for every strategy.
	DefaultPlainURL = "http://127.0.0.1:80"
	// DefaultTLSAddr is Caddy's HTTPS listener on the loopback interface.
	DefaultTLSAddr = "127.0.0.1:443"
)

// Endpoint describes how provisioning reaches Zitadel's Management API
// through Caddy on the installation host.
//
// A secure install is spoken to as https://<AuthHost>, with every connection
// dialled to TLSAddr instead of whatever public DNS says: Caddy answers the
// plain-HTTP listener with a redirect to the public name, and following that
// would depend on hairpin DNS and strip the Authorization header. The TLS
// handshake verifies Caddy's certificate for AuthHost against the system
// roots plus, for the internal strategy, the root CA the installer generated.
type Endpoint struct {
	// Secure selects HTTPS (ZITADEL_EXTERNALSECURE=true).
	Secure bool
	// AuthHost is the external auth domain, used as Host header and SNI.
	AuthHost string
	// PlainURL is Caddy's plain-HTTP base URL. Defaults to DefaultPlainURL.
	PlainURL string
	// TLSAddr is the host:port dialled for HTTPS. Defaults to DefaultTLSAddr.
	TLSAddr string
	// ExtraRootCAFile is an optional PEM bundle trusted in addition to the
	// system roots.
	ExtraRootCAFile string
}

// Client returns the base URL and HTTP client to talk to Zitadel with.
func (e Endpoint) Client() (string, *http.Client, error) {
	if !e.Secure {
		plain := e.PlainURL
		if plain == "" {
			plain = DefaultPlainURL
		}
		return plain, &http.Client{Timeout: requestTimeout, CheckRedirect: refuseRedirect}, nil
	}

	if e.AuthHost == "" {
		return "", nil, errors.New("provisioning: an auth host is required to reach Zitadel over HTTPS")
	}
	addr := e.TLSAddr
	if addr == "" {
		addr = DefaultTLSAddr
	}
	roots, err := rootPool(e.ExtraRootCAFile)
	if err != nil {
		return "", nil, err
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	// Never consult a proxy or DNS: the request must land on this host's
	// Caddy, whatever the auth host resolves to.
	transport.Proxy = nil
	dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}
	transport.DialContext = func(ctx context.Context, network, _ string) (net.Conn, error) {
		return dialer.DialContext(ctx, network, addr)
	}
	transport.TLSClientConfig = &tls.Config{
		ServerName: e.AuthHost,
		RootCAs:    roots,
		MinVersion: tls.VersionTLS12,
	}

	return "https://" + e.AuthHost, &http.Client{
		Transport:     transport,
		Timeout:       requestTimeout,
		CheckRedirect: refuseRedirect,
	}, nil
}

// requestTimeout bounds one Management API call.
const requestTimeout = 30 * time.Second

// refuseRedirect surfaces a redirect as the response itself. Following one
// would leave the loopback listener and drop the bearer token.
func refuseRedirect(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }

// rootPool returns the system roots, extended with extraFile when given.
func rootPool(extraFile string) (*x509.CertPool, error) {
	pool, err := x509.SystemCertPool()
	if err != nil || pool == nil {
		pool = x509.NewCertPool()
	}
	if extraFile == "" {
		return pool, nil
	}
	pemBytes, err := os.ReadFile(extraFile)
	if err != nil {
		return nil, fmt.Errorf("provisioning: read root CA %s: %w", extraFile, err)
	}
	if !pool.AppendCertsFromPEM(pemBytes) {
		return nil, fmt.Errorf("provisioning: %s holds no PEM certificate", extraFile)
	}
	return pool, nil
}
