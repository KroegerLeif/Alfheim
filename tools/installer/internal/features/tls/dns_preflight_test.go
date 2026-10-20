package tls

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeDesec serves the two deSEC endpoints the preflight uses.
func fakeDesec(t *testing.T, token string, zones map[string]string, challenges map[string][]string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Token "+token {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.URL.Path == "/domains/" {
			zone, ok := zones[r.URL.Query().Get("owns_qname")]
			if !ok {
				_, _ = w.Write([]byte(`[]`))
				return
			}
			_, _ = w.Write([]byte(`[{"name":"` + zone + `"}]`))
			return
		}
		// /domains/<zone>/rrsets/<subname>/TXT/
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) == 5 && parts[2] == "rrsets" {
			records, ok := challenges[parts[3]]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			_, _ = w.Write([]byte(`{"records":["` + strings.Join(records, `","`) + `"]}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
}

var loegienZones = map[string]string{"auth.loegien.de": "loegien.de", "alfheim.loegien.de": "loegien.de"}

func TestPreflightSkipsOtherStrategies(t *testing.T) {
	for _, s := range []Strategy{StrategyHetznerDNS, StrategyCloudflareDNS, StrategyCustomCerts, StrategyInternal} {
		// An unreachable API proves nothing is requested.
		p := DNSPreflight{DesecAPI: "http://127.0.0.1:1"}
		warnings, err := p.Check(context.Background(), Config{Strategy: s, APIToken: "x"}, []string{"a.example.com"})
		if err != nil || len(warnings) != 0 {
			t.Fatalf("%s: Check() = %v, %v; want no request", s, warnings, err)
		}
	}
}

func TestPreflightDesecValidToken(t *testing.T) {
	srv := fakeDesec(t, "good", loegienZones, nil)
	defer srv.Close()
	p := DNSPreflight{DesecAPI: srv.URL}
	warnings, err := p.Check(context.Background(), Config{Strategy: StrategyDesecDNS, APIToken: "good"},
		[]string{"auth.loegien.de", "alfheim.loegien.de"})
	if err != nil || len(warnings) != 0 {
		t.Fatalf("Check() = %v, %v; want success without warnings", warnings, err)
	}
}

func TestPreflightDesecRejectedToken(t *testing.T) {
	srv := fakeDesec(t, "good", loegienZones, nil)
	defer srv.Close()
	p := DNSPreflight{DesecAPI: srv.URL}
	_, err := p.Check(context.Background(), Config{Strategy: StrategyDesecDNS, APIToken: "bad"},
		[]string{"auth.loegien.de"})
	if err == nil || !strings.Contains(err.Error(), "rejected the API token") {
		t.Fatalf("Check() error = %v, want a rejected-token error", err)
	}
}

func TestPreflightDesecZoneMissing(t *testing.T) {
	srv := fakeDesec(t, "good", loegienZones, nil)
	defer srv.Close()
	p := DNSPreflight{DesecAPI: srv.URL}
	_, err := p.Check(context.Background(), Config{Strategy: StrategyDesecDNS, APIToken: "good"},
		[]string{"auth.example.com"})
	if err == nil || !strings.Contains(err.Error(), "no zone in this deSEC account contains auth.example.com") {
		t.Fatalf("Check() error = %v, want a missing-zone error", err)
	}
}

func TestPreflightDesecWarnsAboutLeftoverChallenges(t *testing.T) {
	srv := fakeDesec(t, "good", loegienZones, map[string][]string{
		"_acme-challenge.alfheim": {`\"a\"`, `\"b\"`},
	})
	defer srv.Close()
	p := DNSPreflight{DesecAPI: srv.URL}
	warnings, err := p.Check(context.Background(), Config{Strategy: StrategyDesecDNS, APIToken: "good"},
		[]string{"auth.loegien.de", "alfheim.loegien.de"})
	if err != nil {
		t.Fatal(err)
	}
	if len(warnings) != 1 || !strings.Contains(warnings[0], "_acme-challenge.alfheim.loegien.de holds 2 leftover") {
		t.Fatalf("warnings = %q, want one leftover warning for alfheim", warnings)
	}
}

func TestPreflightDesecUnreachableIsOnlyAWarning(t *testing.T) {
	p := DNSPreflight{DesecAPI: "http://127.0.0.1:1"}
	warnings, err := p.Check(context.Background(), Config{Strategy: StrategyDesecDNS, APIToken: "good"},
		[]string{"auth.loegien.de"})
	if err != nil {
		t.Fatalf("Check() error = %v, want only a warning", err)
	}
	if len(warnings) != 1 || !strings.Contains(warnings[0], "Could not verify the deSEC token") {
		t.Fatalf("warnings = %q", warnings)
	}
}

func TestChallengeSubname(t *testing.T) {
	tests := map[[2]string]string{
		{"loegien.de", "loegien.de"}:               "_acme-challenge",
		{"loegien.de", "auth.loegien.de"}:          "_acme-challenge.auth",
		{"loegien.de", "a.b.loegien.de"}:           "_acme-challenge.a.b",
		{"home.example.org", "x.home.example.org"}: "_acme-challenge.x",
	}
	for in, want := range tests {
		if got := challengeSubname(in[0], in[1]); got != want {
			t.Errorf("challengeSubname(%q, %q) = %q, want %q", in[0], in[1], got, want)
		}
	}
}
