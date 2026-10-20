package netguard_test

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"alfheim/chat/internal/shared/netguard"
)

// fakeResolver returns configured addresses per host; hosts can be re-pointed at
// runtime to simulate DNS rebinding.
type fakeResolver struct {
	mu      sync.Mutex
	records map[string][]string
}

func (r *fakeResolver) set(host string, ips ...string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.records[host] = ips
}

func (r *fakeResolver) LookupNetIP(_ context.Context, _, host string) ([]netip.Addr, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ips, ok := r.records[strings.ToLower(host)]
	if !ok {
		return nil, errors.New("no such host")
	}
	out := make([]netip.Addr, 0, len(ips))
	for _, ip := range ips {
		out = append(out, netip.MustParseAddr(ip))
	}
	return out, nil
}

func newResolver() *fakeResolver {
	return &fakeResolver{records: map[string][]string{
		"public.example.com":       {"93.184.216.34"},
		"internal.example.com":     {"10.0.0.7"},
		"loopback.example.com":     {"127.0.0.1"},
		"metadata.example.com":     {"169.254.169.254"},
		"mixed.example.com":        {"93.184.216.34", "192.168.1.5"},
		"host.docker.internal":     {"172.17.0.1"},
		"lan-ollama.home":          {"192.168.1.50"},
		"cgnat.example.com":        {"100.64.1.1"},
		"ula.example.com":          {"fd00::1"},
		"mapped.example.com":       {"::ffff:10.0.0.1"},
		"public6.example.com":      {"2606:4700:4700::1111"},
		"multicast.example.com":    {"224.0.0.1"},
		"unspecified.example.com":  {"0.0.0.0"},
		"linklocal6.example.com":   {"fe80::1"},
		"nat64.example.com":        {"64:ff9b::a00:1"},
		"benchmark.example.com":    {"198.18.0.1"},
		"allowlisted-ip.test":      {"192.168.1.60"},
		"allowlisted-cidr-ip.test": {"10.20.30.40"},
	}}
}

func TestGuard_ValidateURL(t *testing.T) {
	tests := []struct {
		name    string
		spec    string
		url     string
		blocked bool
	}{
		{"public hostname", "", "https://public.example.com/v1", false},
		{"public ipv4 literal", "", "http://93.184.216.34:8080", false},
		{"public ipv6 literal", "", "http://[2606:4700:4700::1111]/", false},
		{"public ipv6 hostname", "", "https://public6.example.com", false},
		{"hostname resolving to private", "", "http://internal.example.com", true},
		{"hostname resolving to loopback", "", "http://loopback.example.com", true},
		{"hostname resolving to metadata", "", "http://metadata.example.com/latest", true},
		{"one private record among public ones", "", "http://mixed.example.com", true},
		{"cloud metadata literal", "", "http://169.254.169.254/latest/meta-data", true},
		{"loopback literal", "", "http://127.0.0.1:8080", true},
		{"loopback range member", "", "http://127.1.2.3", true},
		{"ipv6 loopback", "", "http://[::1]/", true},
		{"ipv6 link-local", "", "http://[fe80::1]/", true},
		{"ipv6 unique local", "", "http://[fd00::1]/", true},
		{"ipv6 unique local via hostname", "", "http://ula.example.com", true},
		{"ipv4-mapped ipv6 private", "", "http://[::ffff:10.0.0.1]/", true},
		{"ipv4-mapped ipv6 private via hostname", "", "http://mapped.example.com", true},
		{"nat64 embedding private ipv4", "", "http://nat64.example.com", true},
		{"unspecified", "", "http://0.0.0.0", true},
		{"unspecified via hostname", "", "http://unspecified.example.com", true},
		{"multicast", "", "http://224.0.0.1", true},
		{"multicast via hostname", "", "http://multicast.example.com", true},
		{"link-local via hostname", "", "http://linklocal6.example.com", true},
		{"rfc1918 10/8", "", "http://10.255.255.255", true},
		{"rfc1918 172.16/12", "", "http://172.16.0.1", true},
		{"rfc1918 192.168/16", "", "http://192.168.1.1", true},
		{"carrier-grade nat", "", "http://100.64.0.1", true},
		{"carrier-grade nat via hostname", "", "http://cgnat.example.com", true},
		{"benchmarking range", "", "http://198.18.0.1", true},
		{"unresolvable host", "", "http://nowhere.example.com", true},
		{"file scheme", "", "file:///etc/passwd", true},
		{"gopher scheme", "", "gopher://public.example.com", true},
		{"ftp scheme", "", "ftp://public.example.com", true},
		{"no scheme", "", "public.example.com", true},
		{"empty host", "", "http://", true},
		{"credentials in url", "", "http://user:pass@public.example.com", true},
		{"unparsable", "", "http://%zz", true},

		{"allowlisted hostname", "host.docker.internal", "http://host.docker.internal:11434", false},
		{"allowlisted hostname is case-insensitive", "Host.Docker.Internal", "http://HOST.docker.internal", false},
		{"hostname not on allowlist stays blocked", "host.docker.internal", "http://lan-ollama.home", true},
		{"allowlisted lan hostname", "host.docker.internal, lan-ollama.home", "http://lan-ollama.home:11434", false},
		{"allowlisted ip", "192.168.1.60", "http://192.168.1.60:11434", false},
		{"allowlisted ip via hostname", "192.168.1.60", "http://allowlisted-ip.test", false},
		{"other ip next to allowlisted ip", "192.168.1.60", "http://192.168.1.61", true},
		{"allowlisted cidr", "10.20.0.0/16", "http://10.20.30.40", false},
		{"allowlisted cidr via hostname", "10.20.0.0/16", "http://allowlisted-cidr-ip.test", false},
		{"outside allowlisted cidr", "10.20.0.0/16", "http://10.21.0.1", true},
		{"allowlisted ipv6 cidr", "fd00::/8", "http://[fd00::1]/", false},
		{"allowlist does not unlock metadata service", "10.0.0.0/8", "http://169.254.169.254", true},
		{"allowlisted host that resolves to metadata is the operator's choice", "metadata.example.com", "http://metadata.example.com", false},
		{"empty allowlist blocks the docker host", "", "http://host.docker.internal", true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			g, err := netguard.NewWithResolver(tc.spec, newResolver())
			if err != nil {
				t.Fatalf("failed to build guard: %v", err)
			}
			err = g.ValidateURL(context.Background(), tc.url)
			if tc.blocked && err == nil {
				t.Errorf("expected %q to be rejected", tc.url)
			}
			if !tc.blocked && err != nil {
				t.Errorf("expected %q to be accepted, got %v", tc.url, err)
			}
		})
	}
}

func TestNew_RejectsInvalidAllowlistEntries(t *testing.T) {
	for _, spec := range []string{"10.0.0.0/99", "bad host", "host:11434", "user@host"} {
		if _, err := netguard.New(spec); err == nil {
			t.Errorf("expected spec %q to be rejected", spec)
		}
	}
	if _, err := netguard.New(" , ,"); err != nil {
		t.Errorf("blank entries must be ignored: %v", err)
	}
}

func TestFromEnv(t *testing.T) {
	ctx := context.Background()

	t.Run("defaults to host.docker.internal when unset", func(t *testing.T) {
		// t.Setenv registers restoration; Unsetenv then makes the variable absent.
		t.Setenv(netguard.EnvAllowedHosts, "")
		_ = os.Unsetenv(netguard.EnvAllowedHosts)
		g := netguard.FromEnv()
		if err := g.ValidateURL(ctx, "http://10.0.0.1"); err == nil {
			t.Error("private ip must stay blocked by default")
		}
	})

	t.Run("an explicitly empty value allows nothing private", func(t *testing.T) {
		t.Setenv(netguard.EnvAllowedHosts, "")
		g := netguard.FromEnv()
		if err := g.ValidateURL(ctx, "http://10.0.0.1"); err == nil {
			t.Error("private ip must stay blocked")
		}
	})

	t.Run("an invalid value falls back to the strictest setting", func(t *testing.T) {
		t.Setenv(netguard.EnvAllowedHosts, "10.0.0.0/99,10.0.0.1")
		g := netguard.FromEnv()
		if err := g.ValidateURL(ctx, "http://10.0.0.1"); err == nil {
			t.Error("a broken allowlist must not widen access")
		}
	})

	t.Run("a configured value is honoured", func(t *testing.T) {
		t.Setenv(netguard.EnvAllowedHosts, "10.0.0.0/8")
		g := netguard.FromEnv()
		if err := g.ValidateURL(ctx, "http://10.0.0.1"); err != nil {
			t.Errorf("allow-listed ip must be accepted: %v", err)
		}
	})
}

func TestGuard_DialRechecksResolvedAddress(t *testing.T) {
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()
	_, port, _ := net.SplitHostPort(srv.Listener.Addr().String())

	resolver := newResolver()
	// rebind.example.com is public when the URL is validated ...
	resolver.set("rebind.example.com", "93.184.216.34")
	g, err := netguard.NewWithResolver("", resolver)
	if err != nil {
		t.Fatal(err)
	}
	target := "http://rebind.example.com:" + port
	if err := g.ValidateURL(context.Background(), target); err != nil {
		t.Fatalf("validation should pass while the name is public: %v", err)
	}

	// ... and flips to loopback before the connection is made.
	resolver.set("rebind.example.com", "127.0.0.1")
	client := g.NewHTTPClient()
	resp, err := client.Get(target)
	if err == nil {
		resp.Body.Close()
		t.Fatal("expected the dial to be rejected after the DNS answer changed")
	}
	if !errors.Is(err, netguard.ErrBlocked) {
		t.Errorf("expected ErrBlocked, got %v", err)
	}
	if hits.Load() != 0 {
		t.Error("the loopback server must never be contacted")
	}
}

func TestGuard_DialConnectsToAllowlistedAddress(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()
	_, port, _ := net.SplitHostPort(srv.Listener.Addr().String())

	resolver := newResolver()
	resolver.set("local-llm.home", "127.0.0.1")
	g, err := netguard.NewWithResolver("local-llm.home", resolver)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := g.NewHTTPClient().Get("http://local-llm.home:" + port)
	if err != nil {
		t.Fatalf("allow-listed destination must be reachable: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("unexpected status %d", resp.StatusCode)
	}
}

func TestGuard_ClientDoesNotFollowRedirects(t *testing.T) {
	var targetHits atomic.Int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		targetHits.Add(1)
	}))
	defer target.Close()
	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer redirector.Close()

	g, err := netguard.New("127.0.0.0/8")
	if err != nil {
		t.Fatal(err)
	}
	resp, err := g.NewHTTPClient().Get(redirector.URL)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusFound {
		t.Errorf("expected the 302 to be returned as is, got %d", resp.StatusCode)
	}
	if targetHits.Load() != 0 {
		t.Error("redirect target must not be contacted")
	}
}

func TestGuard_ClientIgnoresProxyEnvironment(t *testing.T) {
	var proxied atomic.Int32
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		proxied.Add(1)
	}))
	defer proxy.Close()
	t.Setenv("HTTP_PROXY", proxy.URL)
	t.Setenv("http_proxy", proxy.URL)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()

	g, err := netguard.New("127.0.0.0/8")
	if err != nil {
		t.Fatal(err)
	}
	resp, err := g.NewHTTPClient().Get(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if proxied.Load() != 0 {
		t.Error("requests must not be routed through an environment proxy")
	}
}
