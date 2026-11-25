package jellyfin_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"alfheim/dashboard/internal/features/integrations/jellyfin"
	"alfheim/dashboard/internal/features/integrations/media"
	"alfheim/dashboard/internal/features/plugins"
)

const apiKey = "jf-secret-key"

var creds = plugins.Credentials{jellyfin.CredentialAPIKey: apiKey}

// fakeJellyfin is an httptest double of the Jellyfin API.
func fakeJellyfin(t *testing.T, controlled *string) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	auth := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != `MediaBrowser Token="`+apiKey+`"` {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			next(w, r)
		}
	}
	mux.HandleFunc("GET /jf/System/Info", auth(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"Version": "10.11.0", "ServerName": "home"})
	}))
	mux.HandleFunc("GET /jf/Sessions", auth(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("activeWithinSeconds") != "60" {
			t.Errorf("activeWithinSeconds = %q", r.URL.Query().Get("activeWithinSeconds"))
		}
		_, _ = w.Write([]byte(`[
			{"Id":"s1","DeviceName":"Living room TV","SupportsRemoteControl":true,
			 "NowPlayingItem":{"Name":"Episode 1","SeriesName":"Show"},"PlayState":{"IsPaused":true}},
			{"Id":"s2","Client":"Web","SupportsRemoteControl":false,
			 "NowPlayingItem":{"Name":"Song","Artists":["Band"],"AlbumArtist":"Other"},"PlayState":{}},
			{"Id":"idle","DeviceName":"Phone","PlayState":{}}
		]`))
	}))
	mux.HandleFunc("POST /jf/Sessions/{id}/Playing/{cmd}", auth(func(w http.ResponseWriter, r *http.Request) {
		if r.PathValue("id") != "s1" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		*controlled = r.PathValue("cmd")
		w.WriteHeader(http.StatusNoContent)
	}))
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func config(srv *httptest.Server) plugins.Config {
	return plugins.Config{BaseURL: srv.URL + "/jf/"}
}

func TestHealthCheck(t *testing.T) {
	var cmd string
	srv := fakeJellyfin(t, &cmd)
	p := jellyfin.New(srv.Client())
	ctx := context.Background()

	if h := p.HealthCheck(ctx, config(srv), creds); h.Status != plugins.StatusOK || h.Detail != "Jellyfin 10.11.0" {
		t.Errorf("healthy server: %+v", h)
	}
	if h := p.HealthCheck(ctx, config(srv), plugins.Credentials{jellyfin.CredentialAPIKey: "wrong"}); h.Status != plugins.StatusAuthFailed {
		t.Errorf("wrong key: %+v", h)
	}
	if h := p.HealthCheck(ctx, config(srv), nil); h.Status != plugins.StatusInvalidConfig {
		t.Errorf("no key: %+v", h)
	}
	if h := p.HealthCheck(ctx, plugins.Config{BaseURL: srv.URL + "/other"}, creds); h.Status != plugins.StatusInvalidResponse {
		t.Errorf("not jellyfin: %+v", h)
	}
	srv.Close()
	if h := p.HealthCheck(ctx, config(srv), creds); h.Status != plugins.StatusUnreachable {
		t.Errorf("stopped server: %+v", h)
	}
}

func TestNowPlaying(t *testing.T) {
	var cmd string
	srv := fakeJellyfin(t, &cmd)
	items, err := jellyfin.New(srv.Client()).NowPlaying(context.Background(), config(srv), creds)
	if err != nil {
		t.Fatal(err)
	}
	want := []media.Status{
		{Source: "jellyfin", SessionID: "s1", Title: "Episode 1", Artist: "Show", Device: "Living room TV", State: media.StatePaused, CanControl: true},
		{Source: "jellyfin", SessionID: "s2", Title: "Song", Artist: "Band", Device: "Web", State: media.StatePlaying},
	}
	if len(items) != len(want) {
		t.Fatalf("got %+v", items)
	}
	for i := range want {
		if items[i] != want[i] {
			t.Errorf("item %d = %+v, want %+v", i, items[i], want[i])
		}
	}
}

func TestControl(t *testing.T) {
	var cmd string
	srv := fakeJellyfin(t, &cmd)
	p := jellyfin.New(srv.Client())
	ctx := context.Background()
	for c, want := range map[media.Command]string{
		media.CommandPlayPause: "PlayPause", media.CommandNext: "NextTrack",
		media.CommandPrevious: "PreviousTrack", media.CommandStop: "Stop",
	} {
		if err := p.Control(ctx, config(srv), creds, "s1", c); err != nil || cmd != want {
			t.Errorf("%s: err=%v sent=%q", c, err, cmd)
		}
	}
	if err := p.Control(ctx, config(srv), creds, "gone", media.CommandStop); !errors.Is(err, media.ErrSessionNotFound) {
		t.Errorf("unknown session: %v", err)
	}
	if err := p.Control(ctx, config(srv), plugins.Credentials{jellyfin.CredentialAPIKey: "x"}, "s1", media.CommandStop); !errors.Is(err, media.ErrAuthFailed) {
		t.Errorf("wrong key: %v", err)
	}
	if err := p.Control(ctx, config(srv), creds, "s1", "rewind"); !errors.Is(err, media.ErrInvalidCommand) {
		t.Errorf("unknown command: %v", err)
	}
}

func TestValidateConfig(t *testing.T) {
	p := jellyfin.New(http.DefaultClient)
	if p.Type() != "jellyfin" {
		t.Errorf("type = %q", p.Type())
	}
	if err := p.ValidateConfig(plugins.Config{BaseURL: "http://jf:8096"}); err != nil {
		t.Errorf("valid config: %v", err)
	}
	if err := p.ValidateConfig(plugins.Config{}); err == nil {
		t.Error("a missing base URL must be rejected")
	}
	if err := p.ValidateConfig(plugins.Config{BaseURL: "http://jf", Settings: json.RawMessage(`{"x":1}`)}); err == nil {
		t.Error("unknown settings must be rejected")
	}
	if err := p.HealthCheck(context.Background(), plugins.Config{BaseURL: "http://jf"}, plugins.Credentials{jellyfin.CredentialAPIKey: "a\"b"}); err.Status != plugins.StatusAuthFailed {
		t.Errorf("a key with a quote must not be sent: %+v", err)
	}
}
