package navidrome_test

import (
	"context"
	"crypto/md5" //nolint:gosec // Recomputes the Subsonic token.
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"alfheim/dashboard/internal/features/integrations/media"
	"alfheim/dashboard/internal/features/integrations/navidrome"
	"alfheim/dashboard/internal/features/plugins"
)

const (
	user     = "alice"
	password = "sesame"
	salt     = "c19b2d"
	// token is md5("sesame" + "c19b2d").
	token = "26719a1196d2a940705a59634eb18eab"
)

var creds = plugins.Credentials{navidrome.CredentialUsername: user, navidrome.CredentialPassword: password}

func fixedSalt() (string, error) { return salt, nil }

// fakeNavidrome is an httptest double of the Subsonic API that checks the
// token signature of every request.
func fakeNavidrome(t *testing.T) *httptest.Server {
	t.Helper()
	reply := func(w http.ResponseWriter, body map[string]any) {
		_ = json.NewEncoder(w).Encode(map[string]any{"subsonic-response": body})
	}
	signed := func(next func(http.ResponseWriter)) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			for k, want := range map[string]string{"u": user, "s": salt, "v": "1.16.1", "c": "alfheim", "f": "json"} {
				if q.Get(k) != want {
					t.Errorf("%s = %q, want %q", k, q.Get(k), want)
				}
			}
			if q.Has("p") {
				t.Error("the password must never be sent in clear text")
			}
			if q.Get("t") != token {
				reply(w, map[string]any{"status": "failed", "error": map[string]any{"code": 40, "message": "Wrong username or password"}})
				return
			}
			next(w)
		}
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /music/rest/ping.view", signed(func(w http.ResponseWriter) {
		reply(w, map[string]any{"status": "ok", "version": "1.16.1", "type": "navidrome", "serverVersion": "0.58.0"})
	}))
	mux.HandleFunc("GET /music/rest/getNowPlaying.view", signed(func(w http.ResponseWriter) {
		reply(w, map[string]any{"status": "ok", "version": "1.16.1", "nowPlaying": map[string]any{"entry": []map[string]any{
			{"id": "t1", "title": "Track", "artist": "Artist", "username": "alice", "playerId": 3, "playerName": "Kitchen"},
			{"id": "t2", "title": "Other", "artist": "Band", "username": "bob"},
		}}})
	}))
	mux.HandleFunc("GET /broken/rest/ping.view", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("<html>"))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func TestHealthCheck(t *testing.T) {
	srv := fakeNavidrome(t)
	p := navidrome.New(srv.Client(), navidrome.WithSalt(fixedSalt))
	ctx := context.Background()
	cfg := plugins.Config{BaseURL: srv.URL + "/music/"}

	if h := p.HealthCheck(ctx, cfg, creds); h.Status != plugins.StatusOK || h.Detail != "Navidrome 0.58.0" {
		t.Errorf("signed ping: %+v", h)
	}
	wrong := plugins.Credentials{navidrome.CredentialUsername: user, navidrome.CredentialPassword: "nope"}
	if h := p.HealthCheck(ctx, cfg, wrong); h.Status != plugins.StatusAuthFailed {
		t.Errorf("wrong password: %+v", h)
	}
	if h := p.HealthCheck(ctx, cfg, plugins.Credentials{navidrome.CredentialUsername: user}); h.Status != plugins.StatusInvalidConfig {
		t.Errorf("missing password: %+v", h)
	}
	if h := p.HealthCheck(ctx, plugins.Config{BaseURL: srv.URL + "/broken"}, creds); h.Status != plugins.StatusInvalidResponse {
		t.Errorf("not subsonic: %+v", h)
	}
	if h := p.HealthCheck(ctx, plugins.Config{BaseURL: srv.URL + "/missing"}, creds); h.Status != plugins.StatusInvalidResponse {
		t.Errorf("404: %+v", h)
	}
}

func TestNowPlayingIsReadOnly(t *testing.T) {
	srv := fakeNavidrome(t)
	p := navidrome.New(srv.Client(), navidrome.WithSalt(fixedSalt))
	items, err := p.NowPlaying(context.Background(), plugins.Config{BaseURL: srv.URL + "/music"}, creds)
	if err != nil {
		t.Fatal(err)
	}
	want := []media.Status{
		{Source: "navidrome", SessionID: "3", Title: "Track", Artist: "Artist", Device: "Kitchen", State: media.StatePlaying},
		{Source: "navidrome", SessionID: "t2", Title: "Other", Artist: "Band", Device: "bob", State: media.StatePlaying},
	}
	if len(items) != len(want) || items[0] != want[0] || items[1] != want[1] {
		t.Errorf("got %+v", items)
	}
	if _, ok := any(p).(media.Controller); ok {
		t.Error("navidrome must not offer playback control")
	}
}

func TestTransportErrorsAreRedacted(t *testing.T) {
	srv := fakeNavidrome(t)
	cfg := plugins.Config{BaseURL: srv.URL + "/music"}
	srv.Close()
	_, err := navidrome.New(srv.Client(), navidrome.WithSalt(fixedSalt)).NowPlaying(context.Background(), cfg, creds)
	if err == nil {
		t.Fatal("expected a transport error")
	}
	msg := err.Error()
	for _, secret := range []string{token, salt, password} {
		if strings.Contains(msg, secret) {
			t.Errorf("error leaks %q: %s", secret, msg)
		}
	}
	if !strings.Contains(msg, "redacted") {
		t.Errorf("expected the redacted URL in %s", msg)
	}
}

func TestRedactURL(t *testing.T) {
	got := navidrome.RedactURL("http://nd/rest/ping.view?u=alice&t=abc&s=salt&p=pw&f=json")
	for _, secret := range []string{"t=abc", "s=salt", "p=pw"} {
		if strings.Contains(got, secret) {
			t.Errorf("%s still in %s", secret, got)
		}
	}
	if !strings.Contains(got, "u=alice") {
		t.Errorf("non-secret params must stay: %s", got)
	}
	if navidrome.RedactURL("http://nd/rest/ping.view") != "http://nd/rest/ping.view" {
		t.Error("a URL without secrets must stay unchanged")
	}
	if navidrome.RedactURL("http://[::1") != "[redacted]" {
		t.Error("an unparsable URL must be replaced")
	}
}

func TestSaltErrorAndConfig(t *testing.T) {
	failing := func() (string, error) { return "", errors.New("no entropy") }
	p := navidrome.New(http.DefaultClient, navidrome.WithSalt(failing))
	if h := p.HealthCheck(context.Background(), plugins.Config{BaseURL: "http://nd"}, creds); h.Status == plugins.StatusOK {
		t.Errorf("a salt failure must not pass: %+v", h)
	}
	if p.Type() != "navidrome" {
		t.Errorf("type = %q", p.Type())
	}
	if err := p.ValidateConfig(plugins.Config{}); err == nil {
		t.Error("a missing base URL must be rejected")
	}
	if err := p.ValidateConfig(plugins.Config{BaseURL: "http://nd", Settings: json.RawMessage(`{"x":1}`)}); err == nil {
		t.Error("unknown settings must be rejected")
	}
	if err := p.ValidateConfig(plugins.Config{BaseURL: "http://nd"}); err != nil {
		t.Errorf("valid config: %v", err)
	}
}

func TestRandomSaltSignsEachRequest(t *testing.T) {
	seen := map[string]bool{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		s := q.Get("s")
		sum := md5.Sum([]byte(password + s)) //nolint:gosec // Recomputes the Subsonic token.
		if len(s) != 24 || q.Get("t") != hex.EncodeToString(sum[:]) || seen[s] {
			t.Errorf("bad signature: s=%q t=%q", s, q.Get("t"))
		}
		seen[s] = true
		_, _ = w.Write([]byte(`{"subsonic-response":{"status":"ok","version":"1.16.1"}}`))
	}))
	defer srv.Close()
	p := navidrome.New(srv.Client())
	for range 2 {
		h := p.HealthCheck(context.Background(), plugins.Config{BaseURL: srv.URL}, creds)
		if h.Status != plugins.StatusOK || h.Detail != "Subsonic API 1.16.1" {
			t.Errorf("health: %+v", h)
		}
	}
}
