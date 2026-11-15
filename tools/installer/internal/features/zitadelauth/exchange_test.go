package zitadelauth

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func noSleep(context.Context, time.Duration) error { return nil }

func parsedKey(t *testing.T, keyID string) Key {
	t.Helper()
	key, err := ParseKey(keyJSON(t, keyID, false))
	if err != nil {
		t.Fatal(err)
	}
	return key
}

// TestExchangeSendsAValidJWTProfileAssertion checks the request against what
// Zitadel's JWT profile grant verifies: grant type, scope, Host, and an RS256
// assertion signed by the key with iss/sub = user, aud = issuer, kid = key.
func TestExchangeSendsAValidJWTProfileAssertion(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/oauth/v2/token" || r.Host != "auth.example.com" {
			t.Errorf("request = %s Host %s", r.URL.Path, r.Host)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if r.PostForm.Get("grant_type") != jwtBearerGrant || !strings.Contains(r.PostForm.Get("scope"), "zitadel:aud") {
			t.Errorf("form = %v", r.PostForm)
		}
		verifyAssertion(t, r.PostForm.Get("assertion"), now)
		_, _ = w.Write([]byte(`{"access_token":"short-lived","expires_in":43199}`))
	}))
	defer srv.Close()

	e := Exchanger{BaseURL: srv.URL, Host: "auth.example.com", Audience: "https://auth.example.com",
		Now: func() time.Time { return now }}
	token, err := e.Exchange(context.Background(), parsedKey(t, "k1"))
	if err != nil || token != "short-lived" {
		t.Fatalf("Exchange() = %q, %v", token, err)
	}
}

func verifyAssertion(t *testing.T, assertion string, now time.Time) {
	t.Helper()
	parts := strings.Split(assertion, ".")
	if len(parts) != 3 {
		t.Fatalf("assertion has %d parts", len(parts))
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(&testRSAKey().PublicKey, crypto.SHA256, digest[:], sig); err != nil {
		t.Errorf("signature does not verify: %v", err)
	}
	var header map[string]string
	var claims map[string]any
	decodeSegment(t, parts[0], &header)
	decodeSegment(t, parts[1], &claims)
	if header["alg"] != "RS256" || header["kid"] != "k1" {
		t.Errorf("header = %v", header)
	}
	if claims["iss"] != "user-1" || claims["sub"] != "user-1" || claims["aud"] != "https://auth.example.com" {
		t.Errorf("claims = %v", claims)
	}
	if claims["iat"] != float64(now.Unix()) || claims["exp"] != float64(now.Add(assertionLifetime).Unix()) {
		t.Errorf("iat/exp = %v/%v", claims["iat"], claims["exp"])
	}
}

func decodeSegment(t *testing.T, segment string, into any) {
	t.Helper()
	raw, err := base64.RawURLEncoding.DecodeString(segment)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, into); err != nil {
		t.Fatal(err)
	}
}

func TestExchangeRejectionIsNotRetried(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		http.Error(w, `{"error":"invalid_grant"}`, http.StatusBadRequest)
	}))
	defer srv.Close()

	_, err := Exchanger{BaseURL: srv.URL, Sleep: noSleep}.Exchange(context.Background(), parsedKey(t, "k1"))
	if !errors.Is(err, ErrRejected) || calls != 1 {
		t.Fatalf("Exchange() error = %v after %d calls, want ErrRejected after 1", err, calls)
	}
}

func TestExchangeRetriesServerErrors(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&calls, 1) < 3 {
			http.Error(w, "starting", http.StatusServiceUnavailable)
			return
		}
		_, _ = w.Write([]byte(`{"access_token":"t"}`))
	}))
	defer srv.Close()

	token, err := Exchanger{BaseURL: srv.URL, Sleep: noSleep}.Exchange(context.Background(), parsedKey(t, "k1"))
	if err != nil || token != "t" || calls != 3 {
		t.Fatalf("Exchange() = %q, %v after %d calls", token, err, calls)
	}
}

func TestExchangeGivesUpAfterBoundedRetries(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	srv.Close() // every request now fails at the network level

	_, err := Exchanger{BaseURL: srv.URL, Sleep: noSleep}.Exchange(context.Background(), parsedKey(t, "k1"))
	if err == nil || !strings.Contains(err.Error(), "after 5 attempts") {
		t.Fatalf("Exchange() error = %v", err)
	}
}

func TestExchangeStopsWhenSleepFails(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "down", http.StatusBadGateway)
	}))
	defer srv.Close()
	sleepErr := errors.New("cancelled")
	e := Exchanger{BaseURL: srv.URL, Sleep: func(context.Context, time.Duration) error { return sleepErr }}
	if _, err := e.Exchange(context.Background(), parsedKey(t, "k1")); !errors.Is(err, sleepErr) {
		t.Fatalf("Exchange() error = %v, want the sleep error", err)
	}
}

func TestExchangeRejectsUnusableResponses(t *testing.T) {
	cases := map[string]func(w http.ResponseWriter){
		"no content":   func(w http.ResponseWriter) { w.WriteHeader(http.StatusNoContent) },
		"invalid json": func(w http.ResponseWriter) { _, _ = w.Write([]byte("{")) },
		"empty token":  func(w http.ResponseWriter) { _, _ = w.Write([]byte(`{"access_token":""}`)) },
	}
	for name, respond := range cases {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { respond(w) }))
		_, err := Exchanger{BaseURL: srv.URL, Sleep: noSleep}.Exchange(context.Background(), parsedKey(t, "k1"))
		srv.Close()
		if err == nil || errors.Is(err, ErrRejected) {
			t.Errorf("%s: Exchange() error = %v, want a non-rejection failure", name, err)
		}
	}
}

func TestExchangeRefusesUnparsedKeyAndBadURL(t *testing.T) {
	if _, err := (Exchanger{}).Exchange(context.Background(), Key{KeyID: "k1"}); err == nil {
		t.Error("Exchange(unparsed key) error = nil")
	}
	if _, err := (Exchanger{BaseURL: "://bad"}).Exchange(context.Background(), parsedKey(t, "k1")); err == nil {
		t.Error("Exchange(bad URL) error = nil")
	}
}

func TestRealSleep(t *testing.T) {
	if err := realSleep(context.Background(), time.Millisecond); err != nil {
		t.Fatalf("realSleep() error = %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := realSleep(ctx, time.Hour); err == nil {
		t.Fatal("realSleep(cancelled) error = nil")
	}
}
