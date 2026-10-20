package llm_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"alfheim/chat/internal/shared/llm"
)

type providerCase struct {
	name string
	new  func(baseURL string, opts ...llm.ProviderOption) llm.Provider
}

func providerCases() []providerCase {
	return []providerCase{
		{"ollama", func(u string, opts ...llm.ProviderOption) llm.Provider {
			return llm.NewOllamaProvider(u, "m", "secret-key", opts...)
		}},
		{"openai_compatible", func(u string, opts ...llm.ProviderOption) llm.Provider {
			return llm.NewOpenAICompatibleProvider(u, "m", "secret-key", opts...)
		}},
	}
}

func chatRequest() llm.ChatRequest {
	return llm.ChatRequest{Messages: []llm.Message{{Role: llm.RoleUser, Content: "hi"}}, Stream: true}
}

func TestProviders_DoNotFollowRedirectsWithAuthorizationHeader(t *testing.T) {
	for _, pc := range providerCases() {
		t.Run(pc.name, func(t *testing.T) {
			var targetHits atomic.Int32
			var leakedAuth atomic.Value
			target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				targetHits.Add(1)
				leakedAuth.Store(r.Header.Get("Authorization"))
			}))
			defer target.Close()
			redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				http.Redirect(w, r, target.URL+r.URL.Path, http.StatusTemporaryRedirect)
			}))
			defer redirector.Close()

			p := pc.new(redirector.URL)

			_, err := p.ChatStream(context.Background(), chatRequest())
			if err == nil {
				t.Fatal("expected an error for a redirect response")
			}
			if res := p.HealthCheck(context.Background()); res.Status == llm.HealthStatusOK {
				t.Errorf("health check must not succeed through a redirect, got %+v", res)
			}
			if targetHits.Load() != 0 {
				t.Errorf("redirect target was contacted %d times, authorization header: %v", targetHits.Load(), leakedAuth.Load())
			}
		})
	}
}

func TestProviders_UpstreamErrorBodiesAreNotReturned(t *testing.T) {
	const secret = "internal-db-password-hunter2 at 10.9.9.9"
	for _, pc := range providerCases() {
		t.Run(pc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				http.Error(w, secret, http.StatusInternalServerError)
			}))
			defer srv.Close()

			p := pc.new(srv.URL)
			_, err := p.ChatStream(context.Background(), chatRequest())
			var statusErr *llm.UpstreamStatusError
			if !errors.As(err, &statusErr) || statusErr.Status != http.StatusInternalServerError {
				t.Fatalf("expected UpstreamStatusError(500), got %v", err)
			}
			if strings.Contains(err.Error(), "hunter2") || strings.Contains(err.Error(), "10.9.9.9") {
				t.Errorf("error leaks the upstream body: %v", err)
			}

			res := p.HealthCheck(context.Background())
			if strings.Contains(res.Detail, "hunter2") || strings.Contains(res.Detail, "10.9.9.9") {
				t.Errorf("health detail leaks the upstream body: %q", res.Detail)
			}
		})
	}
}

func TestProviders_ConnectionErrorsDoNotRevealTarget(t *testing.T) {
	for _, pc := range providerCases() {
		t.Run(pc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
			addr := srv.Listener.Addr().String()
			srv.Close() // nothing listens on addr anymore

			p := pc.new("http://" + addr)
			_, err := p.ChatStream(context.Background(), chatRequest())
			if !errors.Is(err, llm.ErrUpstreamUnreachable) {
				t.Fatalf("expected ErrUpstreamUnreachable, got %v", err)
			}
			if strings.Contains(err.Error(), addr) {
				t.Errorf("error reveals the target address: %v", err)
			}

			res := p.HealthCheck(context.Background())
			if res.Status != llm.HealthStatusUnreachable || strings.Contains(res.Detail, addr) {
				t.Errorf("unexpected health result: %+v", res)
			}
		})
	}
}

func TestProviders_MidStreamErrorsAreGeneric(t *testing.T) {
	cases := map[string]string{
		"ollama":            `{"error":"secret upstream detail 10.9.9.9"}` + "\n",
		"openai_compatible": "data: {not json secret-upstream-detail\n\n",
	}
	for _, pc := range providerCases() {
		t.Run(pc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, _ = w.Write([]byte(cases[pc.name]))
			}))
			defer srv.Close()

			stream, err := pc.new(srv.URL).ChatStream(context.Background(), chatRequest())
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			var streamErr error
			for chunk := range stream {
				if chunk.Err != nil {
					streamErr = chunk.Err
				}
			}
			if !errors.Is(streamErr, llm.ErrUpstreamStream) {
				t.Fatalf("expected ErrUpstreamStream, got %v", streamErr)
			}
			if strings.Contains(streamErr.Error(), "secret") {
				t.Errorf("stream error leaks upstream detail: %v", streamErr)
			}
		})
	}
}

func TestNewProvider_UsesInjectedHTTPClient(t *testing.T) {
	var used atomic.Bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"models":[],"data":[]}`))
	}))
	defer srv.Close()

	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		used.Store(true)
		return http.DefaultTransport.RoundTrip(r)
	})}
	p, err := llm.NewProvider(llm.ProviderTypeOllama, srv.URL, "m", "", llm.WithHTTPClient(client))
	if err != nil {
		t.Fatal(err)
	}
	p.HealthCheck(context.Background())
	if !used.Load() {
		t.Error("the injected client must be used for upstream requests")
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
