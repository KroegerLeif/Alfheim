package media_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"alfheim/dashboard/internal/features/integrations/media"
	"alfheim/dashboard/internal/features/plugins"
	"alfheim/go-shared/household"
)

var hh = uuid.MustParse("11111111-1111-1111-1111-111111111111")

// basePlugin satisfies plugins.Plugin for the doubles below.
type basePlugin struct{ typ string }

func (b basePlugin) Type() string                        { return b.typ }
func (b basePlugin) ValidateConfig(plugins.Config) error { return nil }
func (b basePlugin) HealthCheck(context.Context, plugins.Config, plugins.Credentials) plugins.Health {
	return plugins.Health{Status: plugins.StatusOK}
}

// readOnly is a media source without control.
type readOnly struct {
	basePlugin
	items []media.Status
	err   error
}

func (r *readOnly) NowPlaying(context.Context, plugins.Config, plugins.Credentials) ([]media.Status, error) {
	return append([]media.Status(nil), r.items...), r.err
}

// controllable is a media source with control.
type controllable struct {
	readOnly
	sent []string
	err  error
}

func (c *controllable) Control(_ context.Context, _ plugins.Config, creds plugins.Credentials, id string, cmd media.Command) error {
	c.sent = append(c.sent, creds["key"]+":"+id+":"+string(cmd))
	return c.err
}

// fakeAccess stands in for *plugins.Service.
type fakeAccess struct {
	enabled map[string]bool
	instErr map[string]error
}

func (f *fakeAccess) IsEnabled(_ context.Context, id uuid.UUID, t string) (bool, error) {
	if id != hh {
		return false, errors.New("wrong household")
	}
	return f.enabled[t], nil
}

func (f *fakeAccess) EnabledInstance(_ context.Context, id uuid.UUID, t string) (plugins.Instance, error) {
	if err := f.instErr[t]; err != nil {
		return plugins.Instance{}, err
	}
	if !f.enabled[t] {
		return plugins.Instance{}, plugins.ErrDisabled
	}
	return plugins.Instance{HouseholdID: id, Type: t, Enabled: true, Credentials: plugins.Credentials{"key": "k-" + t}}, nil
}

type fixture struct {
	ctrl   *controllable
	ro     *readOnly
	access *fakeAccess
	router http.Handler
	logs   *bytes.Buffer
}

func newFixture(t *testing.T, role household.Role) *fixture {
	t.Helper()
	f := &fixture{
		ctrl: &controllable{readOnly: readOnly{basePlugin: basePlugin{"tv"}, items: []media.Status{
			{SessionID: "s1", Title: "Film", State: media.StatePlaying, CanControl: true},
			{SessionID: "s2", Title: "Show", State: media.StatePaused},
		}}},
		ro: &readOnly{basePlugin: basePlugin{"music"}, items: []media.Status{
			{SessionID: "3", Title: "Song", State: media.StatePlaying, CanControl: true},
		}},
		access: &fakeAccess{enabled: map[string]bool{"tv": true, "music": true}, instErr: map[string]error{}},
		logs:   &bytes.Buffer{},
	}
	reg, err := plugins.NewRegistry(f.ctrl, f.ro, basePlugin{"other"})
	if err != nil {
		t.Fatal(err)
	}
	log := slog.New(slog.NewTextHandler(f.logs, nil))
	h := media.NewHandler(media.NewService(f.access, reg, 0, log), log)
	r := chi.NewRouter()
	pass := func(next http.Handler) http.Handler { return next }
	withHousehold := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := household.ContextWithHousehold(r.Context(), &household.HouseholdContext{HouseholdID: hh, Role: role, Subject: "u1"})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
	h.RegisterRoutes(r, pass, withHousehold)
	f.router = r
	return f
}

func (f *fixture) do(method, path string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, httptest.NewRequest(method, path, nil))
	return rec
}

func TestNowPlaying_MergesSourcesAndForcesReadOnly(t *testing.T) {
	f := newFixture(t, household.RoleGuest)
	rec := f.do(http.MethodGet, "/api/v1/integrations/media/now-playing")
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	var body media.NowPlaying
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Items) != 3 || len(body.Sources) != 2 {
		t.Fatalf("got %+v", body)
	}
	for _, it := range body.Items {
		if it.Source == "music" && it.CanControl {
			t.Error("a source without Controller must never report can_control")
		}
		if it.Source == "tv" && it.SessionID == "s1" && !it.CanControl {
			t.Error("a controllable session must keep can_control")
		}
	}
}

func TestNowPlaying_ReportsFailingSourcesAndSkipsDisabled(t *testing.T) {
	f := newFixture(t, household.RoleMember)
	f.access.enabled["music"] = false
	f.ctrl.readOnly.err = fmt.Errorf("wrapped: %w", media.ErrAuthFailed)
	rec := f.do(http.MethodGet, "/api/v1/integrations/media/now-playing")
	var body media.NowPlaying
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Items) != 0 || len(body.Sources) != 1 || body.Sources[0] != (media.SourceState{Source: "tv", Status: "auth_failed"}) {
		t.Errorf("got %+v", body)
	}
}

func TestControl(t *testing.T) {
	f := newFixture(t, household.RoleMember)
	if rec := f.do(http.MethodPost, "/api/v1/integrations/media/tv/sessions/s1/play_pause"); rec.Code != http.StatusNoContent {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	if len(f.ctrl.sent) != 1 || f.ctrl.sent[0] != "k-tv:s1:play_pause" {
		t.Errorf("sent %v", f.ctrl.sent)
	}
	for path, want := range map[string]int{
		"/api/v1/integrations/media/music/sessions/3/stop":  http.StatusConflict,
		"/api/v1/integrations/media/other/sessions/1/stop":  http.StatusNotFound,
		"/api/v1/integrations/media/nope/sessions/1/stop":   http.StatusNotFound,
		"/api/v1/integrations/media/tv/sessions/s1/rewind":  http.StatusBadRequest,
		"/api/v1/integrations/media/tv/sessions/a%2Fb/stop": http.StatusBadRequest,
		"/api/v1/integrations/media/tv/sessions/s1/next":    http.StatusNoContent,
	} {
		if rec := f.do(http.MethodPost, path); rec.Code != want {
			t.Errorf("%s: status %d, want %d (%s)", path, rec.Code, want, rec.Body)
		}
	}
}

func TestControl_ErrorMapping(t *testing.T) {
	path := "/api/v1/integrations/media/tv/sessions/s1/stop"
	for name, tc := range map[string]struct {
		instErr, ctrlErr error
		want             int
		code             string
	}{
		"not configured": {instErr: plugins.ErrNotConfigured, want: http.StatusNotFound, code: media.CodeNotConfigured},
		"disabled":       {instErr: plugins.ErrDisabled, want: http.StatusConflict, code: media.CodeDisabled},
		"no key":         {instErr: plugins.ErrEncryptionUnavailable, want: http.StatusServiceUnavailable, code: media.CodeCredentialsUnavailable},
		"host":           {instErr: plugins.ErrHostNotAllowed, want: http.StatusBadGateway, code: media.CodeUpstream},
		"gone session":   {ctrlErr: media.ErrSessionNotFound, want: http.StatusNotFound, code: media.CodeSessionNotFound},
		"upstream":       {ctrlErr: media.ErrUpstream, want: http.StatusBadGateway, code: media.CodeUpstream},
		"internal":       {ctrlErr: errors.New("boom"), want: http.StatusInternalServerError, code: media.CodeInternal},
	} {
		f := newFixture(t, household.RoleAdmin)
		f.access.instErr["tv"] = tc.instErr
		f.ctrl.err = tc.ctrlErr
		rec := f.do(http.MethodPost, path)
		if rec.Code != tc.want || !strings.Contains(rec.Body.String(), tc.code) {
			t.Errorf("%s: status %d body %s", name, rec.Code, rec.Body)
		}
	}
}

func TestControl_GuestIsForbidden(t *testing.T) {
	f := newFixture(t, household.RoleGuest)
	if rec := f.do(http.MethodPost, "/api/v1/integrations/media/tv/sessions/s1/stop"); rec.Code != http.StatusForbidden {
		t.Errorf("status %d", rec.Code)
	}
	if len(f.ctrl.sent) != 0 {
		t.Error("a guest must not control playback")
	}
}

func TestMissingHouseholdContext(t *testing.T) {
	reg, _ := plugins.NewRegistry()
	log := slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil))
	h := media.NewHandler(media.NewService(&fakeAccess{}, reg, 0, log), log)
	rec := httptest.NewRecorder()
	h.NowPlaying(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status %d", rec.Code)
	}
}

func TestCommandValid(t *testing.T) {
	for _, c := range []media.Command{media.CommandPlayPause, media.CommandNext, media.CommandPrevious, media.CommandStop} {
		if !c.Valid() {
			t.Errorf("%s must be valid", c)
		}
	}
	if media.Command("PlayPause").Valid() {
		t.Error("server-specific names are not commands")
	}
}
