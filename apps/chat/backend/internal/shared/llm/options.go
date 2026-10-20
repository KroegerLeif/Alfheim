package llm

import "net/http"

// ProviderOption customizes a provider at construction time.
type ProviderOption func(*providerOptions)

type providerOptions struct {
	httpClient *http.Client
}

// WithHTTPClient makes the provider use client for all upstream requests. Production
// code passes a client that enforces the outbound destination guard (see netguard).
func WithHTTPClient(client *http.Client) ProviderOption {
	return func(o *providerOptions) { o.httpClient = client }
}

// resolveHTTPClient applies opts and falls back to a client that never follows
// redirects, since a redirect would carry the Authorization header to another host.
func resolveHTTPClient(opts []ProviderOption) *http.Client {
	var o providerOptions
	for _, opt := range opts {
		opt(&o)
	}
	if o.httpClient != nil {
		return o.httpClient
	}
	return &http.Client{
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}
