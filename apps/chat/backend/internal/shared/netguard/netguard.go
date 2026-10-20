// Package netguard restricts the outbound HTTP connections the chat service makes on
// behalf of users (LLM provider base URLs). Model block base URLs are user-supplied, so
// without a guard they are a server-side request forgery vector: they could point at
// loopback services, the cloud metadata endpoint or other internal hosts.
//
// A Guard rejects non-http(s) URLs and any host that resolves to a loopback, link-local,
// unspecified, multicast, private or otherwise non-public address, unless the operator
// allow-listed the host name, IP or CIDR via CHAT_ALLOWED_LLM_HOSTS. The same check runs
// again at dial time on the resolved address, which defeats DNS rebinding.
package netguard

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"strings"
	"time"
)

// EnvAllowedHosts names the environment variable holding the operator allowlist.
const EnvAllowedHosts = "CHAT_ALLOWED_LLM_HOSTS"

// DefaultAllowedHosts is used when CHAT_ALLOWED_LLM_HOSTS is unset, so the documented
// local Ollama setup (Ollama on the Docker host) keeps working out of the box.
const DefaultAllowedHosts = "host.docker.internal"

// ErrBlocked is returned (wrapped) for every URL or address the guard rejects.
var ErrBlocked = errors.New("outbound destination is not allowed")

// extraBlocked lists ranges that netip's classification helpers do not cover.
var extraBlocked = mustPrefixes(
	"0.0.0.0/8",     // "this network"
	"100.64.0.0/10", // carrier-grade NAT
	"192.0.0.0/24",  // IETF protocol assignments
	"198.18.0.0/15", // benchmarking
	"240.0.0.0/4",   // reserved
	"64:ff9b::/96",  // NAT64 (can embed private IPv4 addresses)
	"fc00::/7",      // unique local addresses
)

func mustPrefixes(cidrs ...string) []netip.Prefix {
	out := make([]netip.Prefix, 0, len(cidrs))
	for _, c := range cidrs {
		out = append(out, netip.MustParsePrefix(c))
	}
	return out
}

// Resolver resolves host names; *net.Resolver satisfies it.
type Resolver interface {
	LookupNetIP(ctx context.Context, network, host string) ([]netip.Addr, error)
}

// Guard validates outbound destinations. The zero value is not usable; use New.
type Guard struct {
	hosts    map[string]struct{}
	addrs    []netip.Addr
	prefixes []netip.Prefix
	resolver Resolver
	dialer   *net.Dialer
}

// New builds a Guard from a comma-separated allowlist of host names, IP addresses and
// CIDR ranges. An empty spec allows no private destination at all.
func New(spec string) (*Guard, error) {
	return NewWithResolver(spec, net.DefaultResolver)
}

// NewWithResolver is New with a custom resolver, for tests that must not depend on DNS.
func NewWithResolver(spec string, resolver Resolver) (*Guard, error) {
	g := &Guard{
		hosts:    map[string]struct{}{},
		resolver: resolver,
		dialer:   &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second},
	}
	for _, entry := range strings.Split(spec, ",") {
		entry = strings.ToLower(strings.TrimSpace(entry))
		if entry == "" {
			continue
		}
		if strings.Contains(entry, "/") {
			p, err := netip.ParsePrefix(entry)
			if err != nil {
				return nil, fmt.Errorf("invalid CIDR %q in allowlist: %w", entry, err)
			}
			g.prefixes = append(g.prefixes, p.Masked())
			continue
		}
		if a, err := netip.ParseAddr(strings.Trim(entry, "[]")); err == nil {
			g.addrs = append(g.addrs, a.Unmap())
			continue
		}
		if strings.ContainsAny(entry, " :@?#") {
			return nil, fmt.Errorf("invalid host %q in allowlist", entry)
		}
		g.hosts[strings.TrimSuffix(entry, ".")] = struct{}{}
	}
	return g, nil
}

// FromEnv builds a Guard from CHAT_ALLOWED_LLM_HOSTS (DefaultAllowedHosts when unset).
// An unparsable value is logged and replaced by an empty allowlist, i.e. the strictest
// setting, so a typo can never widen access.
func FromEnv() *Guard {
	spec, ok := os.LookupEnv(EnvAllowedHosts)
	if !ok {
		spec = DefaultAllowedHosts
	}
	g, err := New(spec)
	if err != nil {
		slog.Error("invalid "+EnvAllowedHosts+"; falling back to an empty allowlist", slog.String("error", err.Error()))
		g, _ = New("")
	}
	return g
}

func (g *Guard) hostAllowed(host string) bool {
	_, ok := g.hosts[strings.TrimSuffix(strings.ToLower(host), ".")]
	return ok
}

func (g *Guard) addrAllowlisted(a netip.Addr) bool {
	for _, allowed := range g.addrs {
		if allowed == a {
			return true
		}
	}
	for _, p := range g.prefixes {
		if p.Contains(a) {
			return true
		}
	}
	return false
}

func isPublic(a netip.Addr) bool {
	if !a.IsValid() || a.IsLoopback() || a.IsUnspecified() || a.IsMulticast() ||
		a.IsLinkLocalUnicast() || a.IsLinkLocalMulticast() || a.IsInterfaceLocalMulticast() || a.IsPrivate() {
		return false
	}
	for _, p := range extraBlocked {
		if p.Contains(a) {
			return false
		}
	}
	return true
}

// resolve returns the addresses host maps to and verifies each is permitted.
func (g *Guard) resolve(ctx context.Context, host string) ([]netip.Addr, error) {
	host = strings.Trim(host, "[]")
	if host == "" {
		return nil, fmt.Errorf("%w: empty host", ErrBlocked)
	}
	hostAllowed := g.hostAllowed(host)

	var addrs []netip.Addr
	if a, err := netip.ParseAddr(host); err == nil {
		addrs = []netip.Addr{a.Unmap()}
	} else {
		resolved, err := g.resolver.LookupNetIP(ctx, "ip", host)
		if err != nil {
			return nil, fmt.Errorf("resolve %q: %w", host, err)
		}
		for _, a := range resolved {
			addrs = append(addrs, a.Unmap().WithZone(""))
		}
	}
	if len(addrs) == 0 {
		return nil, fmt.Errorf("%w: host did not resolve", ErrBlocked)
	}
	for _, a := range addrs {
		if hostAllowed || g.addrAllowlisted(a) || isPublic(a) {
			continue
		}
		return nil, fmt.Errorf("%w: %s resolves to a non-public address", ErrBlocked, host)
	}
	return addrs, nil
}

// ValidateURL checks that rawURL is an http(s) URL whose host is permitted.
func (g *Guard) ValidateURL(ctx context.Context, rawURL string) error {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return fmt.Errorf("%w: unparsable url", ErrBlocked)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("%w: scheme must be http or https", ErrBlocked)
	}
	if u.User != nil {
		return fmt.Errorf("%w: credentials in url are not allowed", ErrBlocked)
	}
	_, err = g.resolve(ctx, u.Hostname())
	return err
}

// DialContext resolves addr, re-checks every resolved IP and dials a checked IP
// directly, so the address that was validated is the address that is connected to.
func (g *Guard) DialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid address", ErrBlocked)
	}
	addrs, err := g.resolve(ctx, host)
	if err != nil {
		return nil, err
	}
	var lastErr error
	for _, a := range addrs {
		conn, err := g.dialer.DialContext(ctx, network, net.JoinHostPort(a.String(), port))
		if err == nil {
			return conn, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

// NewHTTPClient returns a client that dials through the guard, never follows redirects
// (a redirect target would bypass URL validation), ignores proxy environment variables
// and bounds connection setup and time-to-first-byte. It sets no total timeout so
// streaming responses are not cut off; callers bound requests with a context.
func (g *Guard) NewHTTPClient() *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			Proxy:                 nil,
			DialContext:           g.DialContext,
			TLSHandshakeTimeout:   10 * time.Second,
			ResponseHeaderTimeout: 120 * time.Second,
			MaxIdleConns:          10,
			IdleConnTimeout:       60 * time.Second,
		},
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}
