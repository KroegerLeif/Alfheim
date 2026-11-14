package apphealth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHTTPProber_MapsResponses(t *testing.T) {
	ok := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer ok.Close()
	down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer down.Close()
	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
		case <-time.After(2 * time.Second):
		}
	}))
	defer slow.Close()
	closed := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	closedURL := closed.URL
	closed.Close()

	p := NewHTTPProber(nil, 100*time.Millisecond)
	cases := []struct {
		name    string
		url     string
		want    State
		wantErr bool
	}{
		{"2xx is online", ok.URL, StateOnline, false},
		{"503 is degraded", down.URL, StateDegraded, true},
		{"timeout is offline", slow.URL, StateOffline, true},
		{"refused is offline", closedURL, StateOffline, true},
		{"bad url is offline", "://bad", StateOffline, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := p.Probe(context.Background(), tc.url)
			if got != tc.want || (err != nil) != tc.wantErr {
				t.Errorf("Probe = %q, %v; want %q, err=%v", got, err, tc.want, tc.wantErr)
			}
		})
	}
}

func TestNewHTTPProber_Defaults(t *testing.T) {
	p := NewHTTPProber(nil, 0)
	if p.timeout != DefaultProbeTimeout || p.client == nil {
		t.Errorf("unexpected defaults: %+v", p)
	}
	if p.client.CheckRedirect == nil {
		t.Error("the default client must not follow redirects")
	}
	if err := p.client.CheckRedirect(nil, nil); err != http.ErrUseLastResponse {
		t.Errorf("CheckRedirect = %v", err)
	}
	custom := &http.Client{}
	if NewHTTPProber(custom, time.Second).client != custom {
		t.Error("custom client not used")
	}
}
