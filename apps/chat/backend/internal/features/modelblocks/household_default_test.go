package modelblocks_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"alfheim/chat/internal/features/modelblocks"
	"alfheim/go-shared/auth"
	"alfheim/go-shared/household"
)

const defaultPath = "/api/v1/chat/model-blocks/household-default"

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// roleRouter serves the model block routes for subject with the given
// membership role, as RequireHousehold would confirm it.
func roleRouter(svc modelblocks.Service, subject string, role household.Role) http.Handler {
	r := chi.NewRouter()
	modelblocks.NewHandler(svc, testLogger()).RegisterRoutes(r, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := context.WithValue(req.Context(), auth.UserContextKey, &auth.UserClaims{Subject: subject})
			ctx = household.ContextWithHousehold(ctx, &household.HouseholdContext{
				HouseholdID: uuid.MustParse(testHouseholdID), Role: role, Subject: subject,
			})
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	return r
}

func serve(t *testing.T, h http.Handler, method string, body any) (*httptest.ResponseRecorder, modelblocks.ResponseDTO) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, defaultPath, &buf))
	var dto modelblocks.ResponseDTO
	if rec.Code < 300 {
		if err := json.Unmarshal(rec.Body.Bytes(), &dto); err != nil {
			t.Fatalf("decode: %v (%s)", err, rec.Body)
		}
	}
	return rec, dto
}

func strPtr(s string) *string { return &s }

func TestHouseholdDefault_OwnerCreatesAdminEdits(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)

	if rec, _ := serve(t, roleRouter(svc, "owner", household.RoleOwner), http.MethodGet, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("no default yet: status %d", rec.Code)
	}

	openAI := modelblocks.HouseholdDefaultRequest{
		ProviderType: "openai_compatible", BaseURL: strPtr("https://api.openai.com/v1"),
		ModelIdentifier: "gpt-4o-mini", APIKey: strPtr("sk-secret-value"),
	}
	rec, created := serve(t, roleRouter(svc, "owner", household.RoleOwner), http.MethodPut, openAI)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: status %d: %s", rec.Code, rec.Body)
	}
	if created.Visibility != modelblocks.VisibilityShared || created.HouseholdID == nil || *created.HouseholdID != testHouseholdID ||
		!created.HasAPIKey || created.DisplayName != "ALFI" {
		t.Errorf("created %+v", created)
	}
	if strings.Contains(rec.Body.String(), "sk-secret-value") {
		t.Error("the API key must never be returned")
	}

	// An admin who did not create the block may change it, keeping the key.
	edit := openAI
	edit.APIKey, edit.ModelIdentifier, edit.DisplayName = nil, "gpt-4.1", "Household AI"
	rec, updated := serve(t, roleRouter(svc, "admin", household.RoleAdmin), http.MethodPut, edit)
	if rec.Code != http.StatusOK || updated.ID != created.ID || updated.ModelIdentifier != "gpt-4.1" || !updated.HasAPIKey {
		t.Fatalf("admin edit: status %d %+v", rec.Code, updated)
	}
	if repo.blocks[created.ID].OwnerUserID != "owner" {
		t.Error("editing must not change the block's owner")
	}

	// Moving the stored key to another host needs a new key or clear_api_key.
	moved := edit
	moved.ProviderType, moved.BaseURL = "ollama", strPtr("http://my-ollama:11434")
	if rec, _ := serve(t, roleRouter(svc, "admin", household.RoleAdmin), http.MethodPut, moved); rec.Code != http.StatusBadRequest {
		t.Errorf("key reuse on a new host: status %d", rec.Code)
	}
	moved.ClearAPIKey = true
	rec, ollama := serve(t, roleRouter(svc, "admin", household.RoleAdmin), http.MethodPut, moved)
	if rec.Code != http.StatusOK || ollama.HasAPIKey || ollama.ProviderType != "ollama" {
		t.Errorf("switch to ollama: status %d %+v", rec.Code, ollama)
	}

	rec, got := serve(t, roleRouter(svc, "guest", household.RoleGuest), http.MethodGet, nil)
	if rec.Code != http.StatusOK || got.ID != created.ID {
		t.Errorf("members read the default: status %d %+v", rec.Code, got)
	}
}

func TestHouseholdDefault_MemberCannotWrite(t *testing.T) {
	svc := newTestService(newFakeRepository())
	req := modelblocks.HouseholdDefaultRequest{ProviderType: "ollama", ModelIdentifier: "llama3.1:8b"}
	for _, role := range []household.Role{household.RoleMember, household.RoleGuest} {
		if rec, _ := serve(t, roleRouter(svc, "m", role), http.MethodPut, req); rec.Code != http.StatusForbidden {
			t.Errorf("%s: status %d", role, rec.Code)
		}
	}
}

func TestHouseholdDefault_RejectsInvalidInput(t *testing.T) {
	h := roleRouter(newTestService(newFakeRepository()), "owner", household.RoleOwner)
	for name, body := range map[string]any{
		"provider":      modelblocks.HouseholdDefaultRequest{ProviderType: "anthropic", ModelIdentifier: "x"},
		"model":         modelblocks.HouseholdDefaultRequest{ProviderType: "ollama"},
		"blocked host":  modelblocks.HouseholdDefaultRequest{ProviderType: "ollama", ModelIdentifier: "x", BaseURL: strPtr("http://169.254.169.254")},
		"unknown field": map[string]any{"provider_type": "ollama", "model_identifier": "x", "household_id": "other"},
	} {
		if rec, _ := serve(t, h, http.MethodPut, body); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d: %s", name, rec.Code, rec.Body)
		}
	}
	blocked := modelblocks.HouseholdDefaultRequest{ProviderType: "ollama", ModelIdentifier: "x", BaseURL: strPtr("http://169.254.169.254")}
	if rec, _ := serve(t, h, http.MethodPut, blocked); !strings.Contains(rec.Body.String(), `"error":"invalid_base_url"`) {
		t.Errorf("a blocked host needs its own error code: %s", rec.Body)
	}
}

func TestHouseholdDefault_PicksOldestSharedBlockOfHousehold(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	ctx := context.Background()
	other := "22222222-2222-2222-2222-222222222222"
	hh := testHouseholdID
	base := time.Now().Add(-time.Hour)
	for i, m := range []*modelblocks.ModelBlock{
		{ID: "private", OwnerUserID: "u", Visibility: modelblocks.VisibilityPrivate},
		{ID: "boot", OwnerUserID: "system", IsBootstrap: true},
		{ID: "foreign", OwnerUserID: "u", Visibility: modelblocks.VisibilityShared, HouseholdID: &other},
		{ID: "newer", OwnerUserID: "x", Visibility: modelblocks.VisibilityShared, HouseholdID: &hh},
		{ID: "oldest", OwnerUserID: "y", Visibility: modelblocks.VisibilityShared, HouseholdID: &hh},
	} {
		m.ProviderType, m.ModelIdentifier = "ollama", "m"
		if err := repo.Create(ctx, m); err != nil {
			t.Fatal(err)
		}
		m.CreatedAt = base.Add(time.Duration(10-i) * time.Minute)
	}
	got, err := svc.HouseholdDefault(ctx, "u", hh)
	if err != nil || got.ID != "oldest" {
		t.Errorf("got %+v err %v", got, err)
	}
	if _, err := svc.HouseholdDefault(ctx, "u", ""); !errors.Is(err, modelblocks.ErrMissingHouseholdID) {
		t.Errorf("without household: %v", err)
	}
	if _, _, err := svc.SaveHouseholdDefault(ctx, "u", "", modelblocks.HouseholdDefaultRequest{ProviderType: "ollama", ModelIdentifier: "m"}); !errors.Is(err, modelblocks.ErrMissingHouseholdID) {
		t.Errorf("save without household: %v", err)
	}
}
