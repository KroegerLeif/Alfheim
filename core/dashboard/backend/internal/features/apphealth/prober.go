package apphealth

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

// DefaultProbeTimeout bounds one probe, so a hanging backend shows as
// offline instead of stalling the dashboard.
const DefaultProbeTimeout = 2 * time.Second

// Prober checks one health endpoint.
type Prober interface {
	// Probe returns the state of the backend behind url and, unless it is
	// online, the reason.
	Probe(ctx context.Context, url string) (State, error)
}

// HTTPProber probes with a GET request.
type HTTPProber struct {
	client  *http.Client
	timeout time.Duration
}

// NewHTTPProber returns a prober using client with the given per-probe
// timeout. A nil client uses a client that does not follow redirects.
func NewHTTPProber(client *http.Client, timeout time.Duration) *HTTPProber {
	if client == nil {
		client = &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		}}
	}
	if timeout <= 0 {
		timeout = DefaultProbeTimeout
	}
	return &HTTPProber{client: client, timeout: timeout}
}

// Probe maps a 2xx answer to online, any other answer to degraded and a
// transport error or timeout to offline.
func (p *HTTPProber) Probe(ctx context.Context, url string) (State, error) {
	ctx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return StateOffline, fmt.Errorf("build health request: %w", err)
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return StateOffline, fmt.Errorf("probe %s: %w", url, err)
	}
	defer resp.Body.Close()
	// Drain a little of the body so the connection can be reused; the
	// content does not matter, only the status does.
	_, _ = io.CopyN(io.Discard, resp.Body, 4096)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return StateOnline, nil
	}
	return StateDegraded, fmt.Errorf("probe %s: status %d", url, resp.StatusCode)
}
