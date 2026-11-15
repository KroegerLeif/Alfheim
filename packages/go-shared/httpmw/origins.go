package httpmw

import (
	"fmt"
	"net/url"
	"strings"
)

// DevAllowedOrigins is the CORS allowlist a development backend uses when
// CORS_ALLOWED_ORIGINS is unset: the local dev servers and the dev gateway
// hosts. A production backend never falls back to it (#921).
var DevAllowedOrigins = []string{
	"http://localhost:3000",
	"http://localhost:5173",
	"http://localhost:8000",
	"http://alfheim.loegien.localhost",
	"http://api.alfheim.loegien.localhost",
}

// ResolveAllowedOrigins returns the CORS allowlist of a backend.
//
// raw is the comma-separated CORS_ALLOWED_ORIGINS value and set whether the
// variable exists. An unset variable yields DevAllowedOrigins outside
// production and an empty list (no cross-origin access; the frontends are
// same-origin behind Caddy) in production. A set value is parsed by
// ParseAllowedOrigins; an empty one also means no cross-origin access.
func ResolveAllowedOrigins(raw string, set bool, environment string) ([]string, error) {
	if !set {
		if strings.EqualFold(strings.TrimSpace(environment), "production") {
			return []string{}, nil
		}
		return append([]string(nil), DevAllowedOrigins...), nil
	}
	return ParseAllowedOrigins(raw)
}

// ParseAllowedOrigins parses a comma-separated list of exact origins
// (scheme://host[:port]). It fails closed: a wildcard, a path, a query, user
// info or a scheme other than http or https rejects the whole list, so a
// typo never widens the allowlist.
func ParseAllowedOrigins(raw string) ([]string, error) {
	origins := []string{}
	for _, entry := range strings.Split(raw, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		origin, err := normaliseOrigin(entry)
		if err != nil {
			return nil, err
		}
		origins = append(origins, origin)
	}
	return origins, nil
}

// normaliseOrigin validates one origin and returns it as browsers send it in
// the Origin header: lower-case scheme and host, no trailing slash.
func normaliseOrigin(entry string) (string, error) {
	if strings.Contains(entry, "*") {
		return "", fmt.Errorf("cors: wildcard origin %q is not allowed; list each origin", entry)
	}
	u, err := url.Parse(entry)
	if err != nil {
		return "", fmt.Errorf("cors: invalid origin %q: %w", entry, err)
	}
	scheme := strings.ToLower(u.Scheme)
	if scheme != "http" && scheme != "https" {
		return "", fmt.Errorf("cors: origin %q must start with http:// or https://", entry)
	}
	if u.Host == "" || u.User != nil || (u.Path != "" && u.Path != "/") || u.RawQuery != "" || u.Fragment != "" {
		return "", fmt.Errorf("cors: %q is not an origin (scheme://host[:port] only)", entry)
	}
	return scheme + "://" + strings.ToLower(u.Host), nil
}
