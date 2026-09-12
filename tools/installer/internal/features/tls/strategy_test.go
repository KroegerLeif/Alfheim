package tls

import (
	"strings"
	"testing"
)

func TestStrategyKnown(t *testing.T) {
	for _, s := range []Strategy{
		StrategyHetznerDNS, StrategyCloudflareDNS, StrategyCustomCerts, StrategyInternal,
	} {
		if !s.Known() {
			t.Errorf("%s must be a known strategy", s)
		}
	}
	if Strategy("nope").Known() {
		t.Error("an unknown strategy must not report as known")
	}
}

func TestParseStrategy(t *testing.T) {
	tests := []struct {
		in      string
		want    Strategy
		wantErr bool
	}{
		{"hetzner", StrategyHetznerDNS, false},
		{"cloudflare", StrategyCloudflareDNS, false},
		{"custom", StrategyCustomCerts, false},
		{"internal", StrategyInternal, false},
		{"", "", true},
		{"letsencrypt", "", true},
	}
	for _, tc := range tests {
		got, err := ParseStrategy(tc.in)
		if tc.wantErr {
			if err == nil {
				t.Errorf("ParseStrategy(%q) error = nil, want a failure", tc.in)
			}
			continue
		}
		if err != nil || got != tc.want {
			t.Errorf("ParseStrategy(%q) = %q, %v", tc.in, got, err)
		}
	}

	// The message must tell the operator what the valid choices are.
	_, err := ParseStrategy("bogus")
	if err == nil {
		t.Fatal("ParseStrategy(bogus) error = nil")
	}
	for _, want := range []string{"hetzner", "cloudflare", "custom", "internal"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q should list %q as a valid strategy", err, want)
		}
	}
}

func TestUsesDNSChallenge(t *testing.T) {
	tests := map[Strategy]bool{
		StrategyHetznerDNS:    true,
		StrategyCloudflareDNS: true,
		StrategyCustomCerts:   false,
		StrategyInternal:      false,
	}
	for s, want := range tests {
		if got := s.UsesDNSChallenge(); got != want {
			t.Errorf("%s.UsesDNSChallenge() = %v, want %v", s, got, want)
		}
	}
}

func TestDNSProvider(t *testing.T) {
	tests := map[Strategy]string{
		StrategyHetznerDNS:    "hetzner",
		StrategyCloudflareDNS: "cloudflare",
		StrategyCustomCerts:   "",
		StrategyInternal:      "",
	}
	for s, want := range tests {
		if got := s.DNSProvider(); got != want {
			t.Errorf("%s.DNSProvider() = %q, want %q", s, got, want)
		}
	}
}

func TestTokenEnvVar(t *testing.T) {
	tests := map[Strategy]string{
		StrategyHetznerDNS:    "HETZNER_API_TOKEN",
		StrategyCloudflareDNS: "CLOUDFLARE_API_TOKEN",
		StrategyCustomCerts:   "",
		StrategyInternal:      "",
	}
	for s, want := range tests {
		if got := s.TokenEnvVar(); got != want {
			t.Errorf("%s.TokenEnvVar() = %q, want %q", s, got, want)
		}
	}
}

func TestStrategiesListIsComplete(t *testing.T) {
	// Every offered strategy must be one the manager can actually handle.
	if len(Strategies) != 4 {
		t.Fatalf("Strategies has %d entries, want 4", len(Strategies))
	}
	for _, s := range Strategies {
		if !s.ID.Known() {
			t.Errorf("offered strategy %s is not known", s.ID)
		}
		if s.Title == "" || s.Description == "" {
			t.Errorf("strategy %s is missing TUI copy", s.ID)
		}
	}
}
