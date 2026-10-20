package tls

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// DefaultDesecAPI is the deSEC REST API base URL.
const DefaultDesecAPI = "https://desec.io/api/v1"

// Preflight checks, before any container starts, that the DNS provider will
// accept the operator's token for the hosts Caddy has to certify. A wrong
// token or a zone in another account otherwise only surfaces minutes later
// as an opaque TLS handshake failure.
type Preflight interface {
	// Check returns a fatal error for a misconfiguration that cannot work,
	// and warnings for findings that may still resolve themselves.
	Check(ctx context.Context, c Config, hosts []string) ([]string, error)
}

// DNSPreflight is the production Preflight. Only the deSEC strategy is
// checked; every other strategy passes unchecked.
type DNSPreflight struct {
	// Client performs the API requests. Defaults to a 15 s timeout client.
	Client *http.Client
	// DesecAPI overrides DefaultDesecAPI, for tests.
	DesecAPI string
}

// Check implements Preflight.
func (p DNSPreflight) Check(ctx context.Context, c Config, hosts []string) ([]string, error) {
	if c.Strategy != StrategyDesecDNS {
		return nil, nil
	}
	api := p.DesecAPI
	if api == "" {
		api = DefaultDesecAPI
	}
	client := p.Client
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	d := desecAPI{base: api, token: strings.TrimSpace(c.APIToken), client: client}

	var warnings []string
	for _, host := range hosts {
		zone, err := d.zoneFor(ctx, host)
		if err != nil {
			if fatal, ok := err.(desecFatal); ok {
				return warnings, fatal
			}
			// deSEC unreachable or throttling: Caddy may still succeed later.
			warnings = append(warnings, fmt.Sprintf("Could not verify the deSEC token for %s: %v", host, err))
			continue
		}
		stale, err := d.challengeValues(ctx, zone, host)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("Could not check %s for leftover ACME records: %v",
				challengeName(host), err))
			continue
		}
		if stale > 0 {
			warnings = append(warnings, fmt.Sprintf(
				"%s holds %d leftover TXT value(s) from an earlier certificate attempt. "+
					"If issuance fails, delete that record in deSEC and wait an hour before retrying "+
					"(see docs/en/how-to/desec-dns-tls.md).", challengeName(host), stale))
		}
	}
	return warnings, nil
}

// desecFatal marks a finding that no retry can fix.
type desecFatal struct{ msg string }

func (e desecFatal) Error() string { return e.msg }

type desecAPI struct {
	base   string
	token  string
	client *http.Client
}

// zoneFor returns the deSEC zone that owns host.
func (d desecAPI) zoneFor(ctx context.Context, host string) (string, error) {
	var domains []struct {
		Name string `json:"name"`
	}
	status, err := d.get(ctx, "/domains/?owns_qname="+url.QueryEscape(host), &domains)
	if err != nil {
		return "", err
	}
	switch {
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		return "", desecFatal{"tls: deSEC rejected the API token (HTTP " + fmt.Sprint(status) +
			"); create a new token at https://desec.io and re-run the installer"}
	case status != http.StatusOK:
		return "", fmt.Errorf("deSEC answered HTTP %d", status)
	case len(domains) == 0:
		return "", desecFatal{fmt.Sprintf("tls: no zone in this deSEC account contains %s; "+
			"add the domain to deSEC or use a token from the account that holds it", host)}
	}
	return domains[0].Name, nil
}

// challengeValues counts the TXT values already published at host's ACME
// challenge name. Caddy removes its own record after every attempt, so any
// value found before Caddy starts is a leftover.
func (d desecAPI) challengeValues(ctx context.Context, zone, host string) (int, error) {
	var rrset struct {
		Records []string `json:"records"`
	}
	path := fmt.Sprintf("/domains/%s/rrsets/%s/TXT/", url.PathEscape(zone),
		url.PathEscape(challengeSubname(zone, host)))
	status, err := d.get(ctx, path, &rrset)
	if err != nil {
		return 0, err
	}
	switch status {
	case http.StatusOK:
		return len(rrset.Records), nil
	case http.StatusNotFound:
		return 0, nil
	default:
		return 0, fmt.Errorf("deSEC answered HTTP %d", status)
	}
}

// get performs an authenticated GET and decodes a 200 body into out.
func (d desecAPI) get(ctx context.Context, path string, out any) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, d.base+path, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Token "+d.token)
	req.Header.Set("Accept", "application/json")
	resp, err := d.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			return resp.StatusCode, fmt.Errorf("decode deSEC response: %w", err)
		}
	}
	return resp.StatusCode, nil
}

// challengeName is the fully qualified ACME DNS-01 record name for host.
func challengeName(host string) string { return "_acme-challenge." + host }

// challengeSubname is challengeName relative to zone, as deSEC addresses
// RRsets.
func challengeSubname(zone, host string) string {
	if host == zone {
		return "_acme-challenge"
	}
	return "_acme-challenge." + strings.TrimSuffix(host, "."+zone)
}
