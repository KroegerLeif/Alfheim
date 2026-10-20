package tls

import (
	"bytes"
	"context"
	"crypto/x509"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// startIngress stands in for Caddy: httptest's certificate is valid for
// example.com only, so any other SNI fails verification the way a host
// without an issued certificate does.
func startIngress(t *testing.T) (addr string, roots *x509.CertPool) {
	t.Helper()
	srv := httptest.NewTLSServer(http.NotFoundHandler())
	t.Cleanup(srv.Close)
	roots = x509.NewCertPool()
	roots.AddCert(srv.Certificate())
	return strings.TrimPrefix(srv.URL, "https://"), roots
}

// fakeClock advances by the requested duration on every Sleep.
type fakeClock struct{ now time.Time }

func (c *fakeClock) Now() time.Time { return c.now }
func (c *fakeClock) Sleep(_ context.Context, d time.Duration) error {
	c.now = c.now.Add(d)
	return nil
}

func TestCertWaiterSucceedsForAValidCertificate(t *testing.T) {
	addr, roots := startIngress(t)
	var out bytes.Buffer
	w := CertWaiter{Addr: addr, Roots: roots, Out: &out}
	if err := w.Wait(context.Background(), []string{"example.com"}); err != nil {
		t.Fatalf("Wait() error = %v", err)
	}
	if !strings.Contains(out.String(), "Certificate for example.com is valid") {
		t.Fatalf("output = %q", out.String())
	}
}

func TestCertWaiterTimesOutWithGuidance(t *testing.T) {
	addr, roots := startIngress(t)
	clock := &fakeClock{now: time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC)}
	var out bytes.Buffer
	w := CertWaiter{
		Addr: addr, Roots: roots, Out: &out,
		Timeout: 2 * time.Minute, Interval: 10 * time.Second,
		Now: clock.Now, Sleep: clock.Sleep,
	}
	err := w.Wait(context.Background(), []string{"auth.loegien.de"})
	if err == nil {
		t.Fatal("Wait() error = nil, want a timeout")
	}
	for _, want := range []string{"no valid certificate for auth.loegien.de", "docker logs alfheim_caddy", "re-run alfheim-setup"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q should mention %q", err, want)
		}
	}
	if !strings.Contains(out.String(), "Still waiting for auth.loegien.de") {
		t.Errorf("output = %q, want progress lines", out.String())
	}
}

func TestCertWaiterStopsOnCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	w := CertWaiter{Addr: "127.0.0.1:1", Timeout: time.Hour, Interval: time.Hour}
	if err := w.Wait(ctx, []string{"auth.loegien.de"}); err == nil {
		t.Fatal("Wait() error = nil, want the cancellation")
	}
}
