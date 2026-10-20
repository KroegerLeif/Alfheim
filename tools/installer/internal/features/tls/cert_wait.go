package tls

import (
	"context"
	cryptotls "crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"net"
	"time"
)

// Defaults for CertWaiter.
const (
	// DefaultIngressAddr is Caddy's HTTPS listener on the installation host.
	DefaultIngressAddr = "127.0.0.1:443"
	// DefaultCertTimeout bounds the wait for one host. deSEC alone accounts
	// for a 90 s propagation delay per attempt, and Caddy retries a failed
	// attempt with backoff, so this leaves room for a second try.
	DefaultCertTimeout = 10 * time.Minute
	// defaultCertInterval is how often the handshake is retried.
	defaultCertInterval = 5 * time.Second
	// progressEvery is how often a still-waiting line is printed.
	progressEvery = 30 * time.Second
)

// CertWaiter blocks until Caddy serves a certificate for each host that
// verifies against the trusted roots. It runs between starting Caddy and
// provisioning Zitadel through it, so a failed ACME challenge is reported as
// such instead of as a TLS error from the Zitadel API.
type CertWaiter struct {
	// Addr is the host:port dialled for every host. Defaults to
	// DefaultIngressAddr; the host name only travels as SNI.
	Addr string
	// Roots verifies the served chain. Nil means the system roots.
	Roots *x509.CertPool
	// Timeout bounds the wait per host. Defaults to DefaultCertTimeout.
	Timeout time.Duration
	// Interval is the pause between handshakes. Defaults to 5 s.
	Interval time.Duration
	// Out receives progress lines. Nil discards them.
	Out io.Writer

	// Now and Sleep are injectable for tests.
	Now   func() time.Time
	Sleep func(ctx context.Context, d time.Duration) error
}

// Wait blocks until every host has a valid certificate, the per-host
// timeout elapses, or ctx is cancelled.
func (w CertWaiter) Wait(ctx context.Context, hosts []string) error {
	w = w.withDefaults()
	for _, host := range hosts {
		if err := w.waitFor(ctx, host); err != nil {
			return err
		}
	}
	return nil
}

func (w CertWaiter) waitFor(ctx context.Context, host string) error {
	start := w.Now()
	deadline := start.Add(w.Timeout)
	nextProgress := start.Add(progressEvery)
	fmt.Fprintf(w.Out, "  Waiting for the TLS certificate for %s …\n", host)

	for {
		issuer, err := w.handshake(ctx, host)
		if err == nil {
			fmt.Fprintf(w.Out, "  Certificate for %s is valid (issued by %s)\n", host, issuer)
			return nil
		}
		now := w.Now()
		if !now.Before(deadline) {
			return fmt.Errorf("tls: Caddy has no valid certificate for %s after %s (last error: %v)\n"+
				"  The ACME DNS-01 challenge did not complete. Inspect it with:\n"+
				"    docker logs alfheim_caddy 2>&1 | grep -iE 'error|challenge'\n"+
				"  Then re-run alfheim-setup; existing secrets are kept.",
				host, w.Timeout, err)
		}
		if !now.Before(nextProgress) {
			fmt.Fprintf(w.Out, "  Still waiting for %s (%s elapsed) …\n", host, now.Sub(start).Round(time.Second))
			nextProgress = now.Add(progressEvery)
		}
		if err := w.Sleep(ctx, w.Interval); err != nil {
			return err
		}
	}
}

// handshake dials Addr with host as SNI and returns the leaf issuer's name
// once the chain verifies for host.
func (w CertWaiter) handshake(ctx context.Context, host string) (string, error) {
	dialer := &cryptotls.Dialer{
		NetDialer: &net.Dialer{Timeout: 10 * time.Second},
		Config: &cryptotls.Config{
			ServerName: host,
			RootCAs:    w.Roots,
			MinVersion: cryptotls.VersionTLS12,
		},
	}
	conn, err := dialer.DialContext(ctx, "tcp", w.Addr)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	certs := conn.(*cryptotls.Conn).ConnectionState().PeerCertificates
	if len(certs) == 0 {
		return "", fmt.Errorf("no certificate presented")
	}
	return certs[0].Issuer.CommonName, nil
}

func (w CertWaiter) withDefaults() CertWaiter {
	if w.Addr == "" {
		w.Addr = DefaultIngressAddr
	}
	if w.Timeout == 0 {
		w.Timeout = DefaultCertTimeout
	}
	if w.Interval == 0 {
		w.Interval = defaultCertInterval
	}
	if w.Out == nil {
		w.Out = io.Discard
	}
	if w.Now == nil {
		w.Now = time.Now
	}
	if w.Sleep == nil {
		w.Sleep = func(ctx context.Context, d time.Duration) error {
			t := time.NewTimer(d)
			defer t.Stop()
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-t.C:
				return nil
			}
		}
	}
	return w
}
