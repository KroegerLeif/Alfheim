package middleware

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

type mockProfileDB struct {
	calls   int
	lastSQL string
	args    []any
	err     error
}

func (m *mockProfileDB) Exec(_ context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	m.calls++
	m.lastSQL = sql
	m.args = args
	return pgconn.NewCommandTag("INSERT 0 1"), m.err
}

func TestEnsureUserProfile(t *testing.T) {
	discardLog := slog.New(slog.NewTextHandler(io.Discard, nil))

	serve := func(db ProfileDB, method string, claims *UserClaims) (int, bool) {
		called := false
		h := EnsureUserProfile(db, discardLog)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			called = true
			w.WriteHeader(http.StatusOK)
		}))
		req := httptest.NewRequest(method, "/api/v1/user/links", nil)
		if claims != nil {
			req = req.WithContext(context.WithValue(req.Context(), UserContextKey, claims))
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code, called
	}

	t.Run("skips the database on safe methods", func(t *testing.T) {
		for _, m := range []string{http.MethodGet, http.MethodHead, http.MethodOptions} {
			db := &mockProfileDB{}
			code, called := serve(db, m, &UserClaims{Subject: "user-1"})
			if code != http.StatusOK || !called || db.calls != 0 {
				t.Errorf("%s: expected pass-through without db call, got code=%d called=%v calls=%d", m, code, called, db.calls)
			}
		}
	})

	t.Run("skips when no claims or empty subject", func(t *testing.T) {
		db := &mockProfileDB{}
		if _, called := serve(db, http.MethodPost, nil); !called {
			t.Error("expected next handler to run without claims")
		}
		if _, called := serve(db, http.MethodPost, &UserClaims{}); !called {
			t.Error("expected next handler to run with empty subject")
		}
		if db.calls != 0 {
			t.Errorf("expected no db calls, got %d", db.calls)
		}
	})

	t.Run("skips when db is nil", func(t *testing.T) {
		if _, called := serve(nil, http.MethodPost, &UserClaims{Subject: "user-1"}); !called {
			t.Error("expected next handler to run with nil db")
		}
	})

	t.Run("provisions the profile from claims on writes", func(t *testing.T) {
		db := &mockProfileDB{}
		claims := &UserClaims{
			Subject: "user-1", Email: "u1@example.com", PreferredUsername: "u1",
			GivenName: "Given", FamilyName: "Family",
		}
		code, called := serve(db, http.MethodPost, claims)
		if code != http.StatusOK || !called || db.calls != 1 {
			t.Fatalf("expected one upsert and pass-through, got code=%d called=%v calls=%d", code, called, db.calls)
		}
		if !strings.Contains(db.lastSQL, "INSERT INTO user_profiles") || !strings.Contains(db.lastSQL, "ON CONFLICT (id) DO NOTHING") {
			t.Errorf("unexpected sql: %s", db.lastSQL)
		}
		want := []any{"user-1", "u1@example.com", "u1", "Given", "Family"}
		for i, w := range want {
			if db.args[i] != w {
				t.Errorf("arg %d: expected %v, got %v", i, w, db.args[i])
			}
		}
	})

	t.Run("falls back to placeholder email and subject username", func(t *testing.T) {
		db := &mockProfileDB{}
		serve(db, http.MethodPut, &UserClaims{Subject: "user-2"})
		if db.args[1] != "user-2"+placeholderEmailDomain || db.args[2] != "user-2" {
			t.Errorf("unexpected fallback args: %v", db.args)
		}
	})

	t.Run("continues when the upsert fails", func(t *testing.T) {
		db := &mockProfileDB{err: errors.New("db down")}
		code, called := serve(db, http.MethodDelete, &UserClaims{Subject: "user-3"})
		if code != http.StatusOK || !called {
			t.Errorf("expected pass-through on db error, got code=%d called=%v", code, called)
		}
	})
}
