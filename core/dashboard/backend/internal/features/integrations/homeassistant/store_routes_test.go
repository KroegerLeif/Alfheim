package homeassistant

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"alfheim/dashboard/internal/features/plugins"
	"alfheim/go-shared/auth"
	"alfheim/go-shared/household"
)

type fakeRow struct {
	hh  uuid.UUID
	err error
}

func (r fakeRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	*dest[0].(*uuid.UUID) = r.hh
	*dest[1].(*[]byte) = []byte("sealed")
	*dest[2].(*string) = "v1"
	return nil
}

type fakeDB struct {
	sqls    []string
	row     fakeRow
	execErr error
}

func (f *fakeDB) Exec(_ context.Context, sql string, _ ...any) (pgconn.CommandTag, error) {
	f.sqls = append(f.sqls, sql)
	return pgconn.NewCommandTag("INSERT 0 1"), f.execErr
}

func (f *fakeDB) Query(context.Context, string, ...any) (pgx.Rows, error) {
	return nil, errors.New("not used")
}

func (f *fakeDB) QueryRow(_ context.Context, sql string, _ ...any) pgx.Row {
	f.sqls = append(f.sqls, sql)
	return f.row
}

func (f *fakeDB) Begin(context.Context) (pgx.Tx, error) { return nil, errors.New("not used") }

func TestSecretStore(t *testing.T) {
	ctx := context.Background()
	db := &fakeDB{row: fakeRow{hh: hhA}}
	s := NewSecretStore(db)
	if err := s.Put(ctx, uuid.New(), hhA, []byte("x"), "v1"); err != nil {
		t.Fatal(err)
	}
	got, err := s.Get(ctx, uuid.New())
	if err != nil || got.HouseholdID != hhA || got.KeyID != "v1" || !strings.Contains(db.sqls[1], "p.household_id = w.household_id") {
		t.Fatalf("get: %+v %v", got, err)
	}
	db.row.err = pgx.ErrNoRows
	if _, err := s.Get(ctx, uuid.New()); !errors.Is(err, ErrNoWebhook) {
		t.Fatalf("missing: %v", err)
	}
	db.row.err = errors.New("db down")
	if _, err := s.Get(ctx, uuid.New()); err == nil || errors.Is(err, ErrNoWebhook) {
		t.Fatalf("db error: %v", err)
	}
	db.execErr = errors.New("db down")
	if err := s.Put(ctx, uuid.New(), hhA, nil, "v1"); err == nil {
		t.Fatal("put error must surface")
	}
}

type mountRecorder struct{ prefix string }

func (m *mountRecorder) Mount(r chi.Router, prefix string) {
	m.prefix = prefix
	r.Get(prefix+"/rules", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
}

type roleTable map[string]household.Role

func (t roleTable) CheckMembership(_ context.Context, hh uuid.UUID, sub string) (household.Membership, error) {
	role, ok := t[hh.String()+"|"+sub]
	if !ok {
		return household.Membership{}, household.ErrNotMember
	}
	return household.Membership{HouseholdID: hh, UserID: sub, Role: role}, nil
}

func TestRoutes_RegisterGuardsRoles(t *testing.T) {
	log, _ := bufLog()
	access := &fakeAccess{inst: map[uuid.UUID]plugins.Instance{}}
	rules := &mountRecorder{}
	rt := Routes{
		Member:  NewMemberHandler(access, NewStates(access, testClient()), log),
		Proxy:   NewMCPProxy(access, testClient(), log),
		Secrets: NewSecretHandler(access, &memSecrets{rows: map[uuid.UUID]SealedSecret{}}, testCipher, log),
		Webhook: NewWebhook(access, &memSecrets{rows: map[uuid.UUID]SealedSecret{}}, testCipher, failingEvents{}, log),
		Rules:   rules,
		Log:     log,
	}
	authMw := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := auth.ContextWithUserClaims(r.Context(), &auth.UserClaims{Subject: r.Header.Get("X-Test-User")})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
	members := roleTable{hhA.String() + "|admin": household.RoleAdmin, hhA.String() + "|member": household.RoleMember}
	r := chi.NewRouter()
	rt.Register(r, authMw, household.RequireHousehold(members, log))
	if rules.prefix != BasePath {
		t.Fatalf("rules mounted at %q", rules.prefix)
	}
	call := func(method, path, user string) int {
		req := httptest.NewRequest(method, path, nil)
		req.Header.Set("X-Test-User", user)
		req.Header.Set(household.HouseholdHeader, hhA.String())
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec.Code
	}
	for _, tc := range []struct {
		method, path, user string
		want               int
	}{
		{http.MethodGet, BasePath + "/status", "member", http.StatusOK},
		{http.MethodGet, BasePath + "/status", "stranger", http.StatusForbidden},
		{http.MethodGet, BasePath + "/mcp", "member", http.StatusMethodNotAllowed},
		{http.MethodGet, BasePath + "/rules", "member", http.StatusForbidden},
		{http.MethodGet, BasePath + "/rules", "admin", http.StatusTeapot},
		{http.MethodGet, BasePath + "/webhook", "member", http.StatusForbidden},
		{http.MethodGet, BasePath + "/webhook", "admin", http.StatusNotFound},
		{http.MethodPost, EventsPath, "", http.StatusNotFound},
	} {
		if got := call(tc.method, tc.path, tc.user); got != tc.want {
			t.Errorf("%s %s as %q: want %d, got %d", tc.method, tc.path, tc.user, tc.want, got)
		}
	}
}
