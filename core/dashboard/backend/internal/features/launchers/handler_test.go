package launchers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"alfheim/go-shared/auth"
	"alfheim/go-shared/household"
)

// memRepo is an in-memory Repository that filters by household like the SQL one.
type memRepo struct {
	mu   sync.Mutex
	rows map[uuid.UUID]Launcher
	err  error
}

func newMemRepo() *memRepo { return &memRepo{rows: map[uuid.UUID]Launcher{}} }

func (m *memRepo) List(_ context.Context, hh uuid.UUID, limit, offset int) (Page, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.err != nil {
		return Page{}, m.err
	}
	var all []Launcher
	for _, l := range m.rows {
		if l.HouseholdID == hh {
			all = append(all, l)
		}
	}
	sort.Slice(all, func(i, j int) bool { return all[i].DisplayOrder < all[j].DisplayOrder })
	total := len(all)
	if offset > len(all) {
		offset = len(all)
	}
	all = all[offset:]
	if limit < len(all) {
		all = all[:limit]
	}
	return Page{Items: all, Total: total}, nil
}

func (m *memRepo) Create(_ context.Context, l *Launcher) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.err != nil {
		return m.err
	}
	l.ID = uuid.New()
	l.CreatedAt, l.UpdatedAt = time.Now(), time.Now()
	m.rows[l.ID] = *l
	return nil
}

func (m *memRepo) Update(_ context.Context, l *Launcher) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	old, ok := m.rows[l.ID]
	if !ok || old.HouseholdID != l.HouseholdID {
		return ErrNotFound
	}
	l.CreatedBy, l.CreatedAt, l.UpdatedAt = old.CreatedBy, old.CreatedAt, time.Now()
	m.rows[l.ID] = *l
	return nil
}

func (m *memRepo) Delete(_ context.Context, hh, id uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	old, ok := m.rows[id]
	if !ok || old.HouseholdID != hh {
		return ErrNotFound
	}
	delete(m.rows, id)
	return nil
}

// fakeMembership answers like core/household from a fixed role table.
type fakeMembership map[string]household.Role

func (f fakeMembership) CheckMembership(_ context.Context, hh uuid.UUID, sub string) (household.Membership, error) {
	role, ok := f[hh.String()+"|"+sub]
	if !ok {
		return household.Membership{}, household.ErrNotMember
	}
	return household.Membership{HouseholdID: hh, UserID: sub, Role: role}, nil
}

var (
	hhA = uuid.MustParse("11111111-1111-4111-8111-111111111111")
	hhB = uuid.MustParse("22222222-2222-4222-8222-222222222222")
)

type fixture struct {
	router http.Handler
	repo   *memRepo
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	members := fakeMembership{
		hhA.String() + "|admin-a":  household.RoleAdmin,
		hhA.String() + "|owner-a":  household.RoleOwner,
		hhA.String() + "|member-a": household.RoleMember,
		hhA.String() + "|guest-a":  household.RoleGuest,
		hhB.String() + "|member-b": household.RoleMember,
		hhB.String() + "|admin-b":  household.RoleAdmin,
	}
	// Test auth: the subject comes from a header instead of a signed token.
	authMw := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), auth.UserContextKey, &auth.UserClaims{Subject: r.Header.Get("X-Test-User")})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
	repo := newMemRepo()
	h := NewHandler(NewService(repo), log)
	r := chi.NewRouter()
	h.RegisterRoutes(r, authMw, household.RequireHousehold(members, log))
	return &fixture{router: r, repo: repo}
}

func (f *fixture) do(t *testing.T, method, path, user string, hh uuid.UUID, body any) *httptest.ResponseRecorder {
	t.Helper()
	var buf io.Reader
	switch b := body.(type) {
	case nil:
	case string:
		buf = strings.NewReader(b)
	default:
		raw, err := json.Marshal(b)
		if err != nil {
			t.Fatal(err)
		}
		buf = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, buf)
	req.Header.Set("X-Test-User", user)
	req.Header.Set(household.HouseholdHeader, hh.String())
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	return rec
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.NewDecoder(rec.Body).Decode(&v); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	return v
}

type errBody struct {
	Detail struct {
		Code   string       `json:"code"`
		Errors []FieldError `json:"errors"`
	} `json:"detail"`
}

var jellyfin = LauncherRequest{Title: "Jellyfin", URL: "https://jellyfin.home.example:8096/web", Icon: "clapperboard", Description: "Movies"}

func TestLaunchers_HouseholdIsolation(t *testing.T) {
	f := newFixture(t)

	rec := f.do(t, http.MethodPost, "/api/v1/launchers", "admin-a", hhA, jellyfin)
	if rec.Code != http.StatusCreated {
		t.Fatalf("admin create: status %d, body %s", rec.Code, rec.Body)
	}
	created := decode[LauncherResponse](t, rec)
	if created.Title != "Jellyfin" || created.Icon != "clapperboard" || created.ID == "" {
		t.Fatalf("unexpected launcher %+v", created)
	}
	if got := f.repo.rows[uuid.MustParse(created.ID)]; got.HouseholdID != hhA || got.CreatedBy != "admin-a" {
		t.Fatalf("stored with household %s by %q, want %s by admin-a", got.HouseholdID, got.CreatedBy, hhA)
	}

	rec = f.do(t, http.MethodGet, "/api/v1/launchers", "member-a", hhA, nil)
	list := decode[ListResponse](t, rec)
	if rec.Code != http.StatusOK || list.Total != 1 || len(list.Items) != 1 || list.Items[0].ID != created.ID {
		t.Fatalf("member of the same household: status %d, list %+v", rec.Code, list)
	}
	if list.Limit != DefaultLimit || list.Offset != 0 {
		t.Errorf("page = %d/%d, want %d/0", list.Limit, list.Offset, DefaultLimit)
	}

	rec = f.do(t, http.MethodGet, "/api/v1/launchers", "member-b", hhB, nil)
	if list := decode[ListResponse](t, rec); rec.Code != http.StatusOK || list.Total != 0 || len(list.Items) != 0 {
		t.Fatalf("member of another household must see nothing: status %d, list %+v", rec.Code, list)
	}

	// Naming household A in the header does not help a non-member.
	if rec := f.do(t, http.MethodGet, "/api/v1/launchers", "member-b", hhA, nil); rec.Code != http.StatusForbidden {
		t.Fatalf("non-member of household A: status %d, want 403", rec.Code)
	}

	// An admin of household B cannot touch household A's launcher.
	path := "/api/v1/launchers/" + created.ID
	if rec := f.do(t, http.MethodPut, path, "admin-b", hhB, jellyfin); rec.Code != http.StatusNotFound {
		t.Fatalf("cross-household update: status %d, want 404", rec.Code)
	}
	if rec := f.do(t, http.MethodDelete, path, "admin-b", hhB, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("cross-household delete: status %d, want 404", rec.Code)
	}
}

func TestLaunchers_WritesNeedOwnerOrAdmin(t *testing.T) {
	f := newFixture(t)
	rec := f.do(t, http.MethodPost, "/api/v1/launchers", "owner-a", hhA, jellyfin)
	if rec.Code != http.StatusCreated {
		t.Fatalf("owner create: status %d", rec.Code)
	}
	path := "/api/v1/launchers/" + decode[LauncherResponse](t, rec).ID

	for _, user := range []string{"member-a", "guest-a"} {
		for _, tc := range []struct {
			method, path string
			body         any
		}{
			{http.MethodPost, "/api/v1/launchers", jellyfin},
			{http.MethodPut, path, jellyfin},
			{http.MethodDelete, path, nil},
		} {
			rec := f.do(t, tc.method, tc.path, user, hhA, tc.body)
			if rec.Code != http.StatusForbidden {
				t.Fatalf("%s %s %s: status %d, want 403", user, tc.method, tc.path, rec.Code)
			}
			if code := decode[errBody](t, rec).Detail.Code; code != household.CodeHouseholdRoleForbidden {
				t.Fatalf("%s %s: code %q", user, tc.method, code)
			}
		}
	}
	if len(f.repo.rows) != 1 {
		t.Fatalf("forbidden writes changed the store: %d rows", len(f.repo.rows))
	}
}

func TestLaunchers_RejectsInvalidInput(t *testing.T) {
	f := newFixture(t)
	tests := []struct {
		name  string
		req   LauncherRequest
		field string
	}{
		{"javascript url", LauncherRequest{Title: "x", URL: "javascript:alert(1)"}, "url"},
		{"userinfo url", LauncherRequest{Title: "x", URL: "https://user:pass@jellyfin.example"}, "url"},
		{"user only url", LauncherRequest{Title: "x", URL: "https://user@jellyfin.example"}, "url"},
		{"data url", LauncherRequest{Title: "x", URL: "data:text/html,hi"}, "url"},
		{"ftp url", LauncherRequest{Title: "x", URL: "ftp://files.example"}, "url"},
		{"relative url", LauncherRequest{Title: "x", URL: "/pantry"}, "url"},
		{"missing host", LauncherRequest{Title: "x", URL: "https:///path"}, "url"},
		{"empty port host", LauncherRequest{Title: "x", URL: "http://:8080"}, "url"},
		{"unparsable url", LauncherRequest{Title: "x", URL: "http://[::1"}, "url"},
		{"padded url", LauncherRequest{Title: "x", URL: " https://a.example"}, "url"},
		{"backslash url", LauncherRequest{Title: "x", URL: "https:\\\\a.example"}, "url"},
		{"empty url", LauncherRequest{Title: "x"}, "url"},
		{"long url", LauncherRequest{Title: "x", URL: "https://a.example/" + strings.Repeat("a", MaxURLLength)}, "url"},
		{"empty title", LauncherRequest{Title: "  ", URL: "https://a.example"}, "title"},
		{"long title", LauncherRequest{Title: strings.Repeat("t", MaxTitleLength+1), URL: "https://a.example"}, "title"},
		{"control title", LauncherRequest{Title: "a\nb", URL: "https://a.example"}, "title"},
		{"unknown icon", LauncherRequest{Title: "x", URL: "https://a.example", Icon: "skull"}, "icon"},
		{"long description", LauncherRequest{Title: "x", URL: "https://a.example", Description: strings.Repeat("d", MaxDescriptionLength+1)}, "description"},
		{"negative order", LauncherRequest{Title: "x", URL: "https://a.example", DisplayOrder: -1}, "display_order"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := f.do(t, http.MethodPost, "/api/v1/launchers", "admin-a", hhA, tc.req)
			if rec.Code != http.StatusUnprocessableEntity {
				t.Fatalf("status %d, want 422 (%s)", rec.Code, rec.Body)
			}
			body := decode[errBody](t, rec)
			if body.Detail.Code != CodeValidation || len(body.Detail.Errors) != 1 || body.Detail.Errors[0].Field != tc.field {
				t.Fatalf("unexpected error body %+v", body)
			}
		})
	}
	if len(f.repo.rows) != 0 {
		t.Fatalf("rejected input was stored")
	}
}

func TestLaunchers_RejectsBadBodiesAndIDs(t *testing.T) {
	f := newFixture(t)
	if rec := f.do(t, http.MethodPost, "/api/v1/launchers", "admin-a", hhA, `{"title":"x","url":"https://a.example","household_id":"`+hhB.String()+`"}`); rec.Code != http.StatusBadRequest {
		t.Fatalf("household_id in the payload: status %d, want 400", rec.Code)
	}
	if rec := f.do(t, http.MethodPost, "/api/v1/launchers", "admin-a", hhA, `{not json`); rec.Code != http.StatusBadRequest {
		t.Fatalf("malformed json: status %d, want 400", rec.Code)
	}
	if rec := f.do(t, http.MethodPut, "/api/v1/launchers/not-a-uuid", "admin-a", hhA, jellyfin); rec.Code != http.StatusNotFound {
		t.Fatalf("bad id: status %d, want 404", rec.Code)
	}
	if rec := f.do(t, http.MethodDelete, "/api/v1/launchers/not-a-uuid", "admin-a", hhA, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("bad id: status %d, want 404", rec.Code)
	}
	if rec := f.do(t, http.MethodPut, "/api/v1/launchers/"+uuid.NewString(), "admin-a", hhA, `{`); rec.Code != http.StatusBadRequest {
		t.Fatalf("malformed update: status %d, want 400", rec.Code)
	}
	if rec := f.do(t, http.MethodPut, "/api/v1/launchers/"+uuid.NewString(), "admin-a", hhA, LauncherRequest{Title: "x", URL: "javascript:1"}); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid update: status %d, want 422", rec.Code)
	}
}

func TestLaunchers_UpdateDeleteAndDefaults(t *testing.T) {
	f := newFixture(t)
	rec := f.do(t, http.MethodPost, "/api/v1/launchers", "admin-a", hhA, LauncherRequest{Title: "Wiki", URL: "http://wiki.lan"})
	created := decode[LauncherResponse](t, rec)
	if created.Icon != DefaultIcon {
		t.Fatalf("icon = %q, want default %q", created.Icon, DefaultIcon)
	}
	path := "/api/v1/launchers/" + created.ID

	rec = f.do(t, http.MethodPut, path, "owner-a", hhA, LauncherRequest{Title: "Home Assistant", URL: "http://ha.lan:8123", Icon: "house", DisplayOrder: 2})
	if rec.Code != http.StatusOK {
		t.Fatalf("update: status %d (%s)", rec.Code, rec.Body)
	}
	if got := decode[LauncherResponse](t, rec); got.Title != "Home Assistant" || got.Icon != "house" || got.DisplayOrder != 2 {
		t.Fatalf("unexpected update result %+v", got)
	}
	if got := f.repo.rows[uuid.MustParse(created.ID)]; got.CreatedBy != "admin-a" {
		t.Fatalf("update must keep the creator, got %q", got.CreatedBy)
	}

	if rec := f.do(t, http.MethodDelete, path, "admin-a", hhA, nil); rec.Code != http.StatusNoContent {
		t.Fatalf("delete: status %d", rec.Code)
	}
	if rec := f.do(t, http.MethodDelete, path, "admin-a", hhA, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("second delete: status %d, want 404", rec.Code)
	}
}

func TestLaunchers_Pagination(t *testing.T) {
	f := newFixture(t)
	for i := range 3 {
		req := LauncherRequest{Title: "App", URL: "https://a.example", DisplayOrder: i}
		if rec := f.do(t, http.MethodPost, "/api/v1/launchers", "admin-a", hhA, req); rec.Code != http.StatusCreated {
			t.Fatalf("create %d: status %d", i, rec.Code)
		}
	}
	rec := f.do(t, http.MethodGet, "/api/v1/launchers?limit=1&offset=1", "member-a", hhA, nil)
	list := decode[ListResponse](t, rec)
	if list.Total != 3 || len(list.Items) != 1 || list.Items[0].DisplayOrder != 1 || list.Limit != 1 || list.Offset != 1 {
		t.Fatalf("unexpected page %+v", list)
	}
	for _, q := range []string{"limit=0", "limit=101", "limit=x", "offset=-1", "offset=x"} {
		if rec := f.do(t, http.MethodGet, "/api/v1/launchers?"+q, "member-a", hhA, nil); rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("%s: status %d, want 422", q, rec.Code)
		}
	}
}

func TestLaunchers_StoreFailureIs500(t *testing.T) {
	f := newFixture(t)
	f.repo.err = errors.New("connection reset")
	if rec := f.do(t, http.MethodGet, "/api/v1/launchers", "member-a", hhA, nil); rec.Code != http.StatusInternalServerError {
		t.Fatalf("list: status %d, want 500", rec.Code)
	}
	rec := f.do(t, http.MethodPost, "/api/v1/launchers", "admin-a", hhA, jellyfin)
	if rec.Code != http.StatusInternalServerError || decode[errBody](t, rec).Detail.Code != CodeInternal {
		t.Fatalf("create: status %d, want 500 internal_error", rec.Code)
	}
}

func TestHandler_WithoutHouseholdContextFailsClosed(t *testing.T) {
	h := NewHandler(NewService(newMemRepo()), slog.New(slog.NewTextHandler(io.Discard, nil)))
	for _, fn := range []http.HandlerFunc{h.List, h.Create, h.Update, h.Delete} {
		rec := httptest.NewRecorder()
		fn(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("status %d, want 500", rec.Code)
		}
	}
}

func TestValidationError_Message(t *testing.T) {
	err := (LauncherRequest{}).Validate()
	if err == nil || !strings.Contains(err.Error(), "title: title is required") || !strings.Contains(err.Error(), "url: url is required") {
		t.Fatalf("unexpected error %v", err)
	}
}
