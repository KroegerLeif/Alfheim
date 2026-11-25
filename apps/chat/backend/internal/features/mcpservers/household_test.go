package mcpservers_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"alfheim/chat/internal/features/mcpservers"
	"alfheim/chat/internal/shared/mcp"
)

const (
	householdA = "11111111-1111-4111-8111-111111111111"
	householdB = "22222222-2222-4222-8222-222222222222"
)

// fakeDashboard enables Home Assistant for household A only, and only for
// the user token it knows, like the dashboard's membership-checked endpoint.
func fakeDashboard(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/integrations/home-assistant/status" || r.Header.Get("Authorization") != "Bearer user-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch r.Header.Get("X-Household-ID") {
		case householdA:
			_, _ = w.Write([]byte(`{"enabled":true,"mcp_available":true}`))
		case householdB:
			_, _ = w.Write([]byte(`{"enabled":false,"mcp_available":false}`))
		case "garbage":
			_, _ = w.Write([]byte(`{`))
		default:
			w.WriteHeader(http.StatusForbidden)
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func callerCtx(household string) context.Context {
	return mcp.WithCallerCredentials(context.Background(),
		mcp.CallerCredentials{AccessToken: "user-token", HouseholdID: household, UserID: "u"})
}

func TestListEnabledServers_HomeAssistantIsHouseholdScoped(t *testing.T) {
	dash := fakeDashboard(t)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := mcpservers.NewService(newFakeRepository(), log, mcpservers.NewDashboardHomeAssistant(dash.URL+"/", dash.Client()))

	refs, err := svc.ListEnabledServers(callerCtx(householdA))
	if err != nil || len(refs) != 1 || refs[0].Slug != mcpservers.HomeAssistantSlug ||
		refs[0].EndpointURL != dash.URL+"/api/v1/integrations/home-assistant/mcp" || refs[0].RegistryID() != nil {
		t.Fatalf("household A: %+v %v", refs, err)
	}
	for _, ctx := range []context.Context{callerCtx(householdB), callerCtx("other"), callerCtx("garbage"), context.Background()} {
		refs, err := svc.ListEnabledServers(ctx)
		if err != nil || len(refs) != 0 {
			t.Fatalf("household A's Home Assistant must never be listed for another caller: %+v %v", refs, err)
		}
	}
}

func TestDashboardHomeAssistant_Errors(t *testing.T) {
	for _, base := range []string{"http://[::1", "http://127.0.0.1:1"} {
		if _, err := mcpservers.NewDashboardHomeAssistant(base, http.DefaultClient).HouseholdServers(callerCtx(householdA)); err == nil {
			t.Errorf("%s: want an error", base)
		}
	}
	if id := (mcp.ServerRef{ID: "x"}).RegistryID(); id == nil || *id != "x" {
		t.Error("a registry server keeps its id")
	}
}
