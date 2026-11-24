package membership

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"reflect"
	"testing"

	"github.com/go-chi/chi/v5"

	"alfheim/household/internal/features/servicebindings"
)

type fakeResolver struct {
	bindings map[string][]string // key: household|principal
	err      error
}

func (f *fakeResolver) Resolve(_ context.Context, householdID, principalID string) (servicebindings.Binding, error) {
	if f.err != nil {
		return servicebindings.Binding{}, f.err
	}
	scopes, ok := f.bindings[householdID+"|"+principalID]
	if !ok {
		return servicebindings.Binding{}, servicebindings.ErrNotFound
	}
	return servicebindings.Binding{HouseholdID: householdID, PrincipalID: principalID, Scopes: scopes}, nil
}

func newServiceRouter(resolver ServiceResolver) http.Handler {
	r := chi.NewRouter()
	reader := &fakeReader{}
	NewHandler(reader, token, slog.New(slog.NewTextHandler(io.Discard, nil)), WithServiceBindings(resolver)).RegisterRoutes(r)
	return r
}

func TestGetMembership_ServicePrincipal(t *testing.T) {
	resolver := &fakeResolver{bindings: map[string][]string{hhID + "|integrations": {"chores:create_instance"}}}
	h := newServiceRouter(resolver)

	t.Run("bound principal answers SERVICE with scopes", func(t *testing.T) {
		rec := do(h, "/internal/v1/memberships/"+hhID+"/integrations", "Bearer "+token)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		var got Response
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		want := Response{HouseholdID: hhID, UserID: "integrations", Role: RoleService, Scopes: []string{"chores:create_instance"}}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("unexpected body %+v", got)
		}
	})

	t.Run("other household is 404", func(t *testing.T) {
		rec := do(h, "/internal/v1/memberships/11111111-1111-1111-1111-111111111111/integrations", "Bearer "+token)
		if rec.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", rec.Code)
		}
	})

	t.Run("revocation takes effect on the next lookup", func(t *testing.T) {
		delete(resolver.bindings, hhID+"|integrations")
		if rec := do(h, "/internal/v1/memberships/"+hhID+"/integrations", "Bearer "+token); rec.Code != http.StatusNotFound {
			t.Errorf("expected 404 after revocation, got %d", rec.Code)
		}
	})

	t.Run("resolver failure is 500", func(t *testing.T) {
		failing := newServiceRouter(&fakeResolver{err: errors.New("db down")})
		if rec := do(failing, "/internal/v1/memberships/"+hhID+"/integrations", "Bearer "+token); rec.Code != http.StatusInternalServerError {
			t.Errorf("expected 500, got %d", rec.Code)
		}
	})
}
