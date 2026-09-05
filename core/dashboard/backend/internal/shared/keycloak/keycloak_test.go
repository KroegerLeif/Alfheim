package keycloak

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Nerzal/gocloak/v13"

	"alfheim/dashboard/config"
)

func TestNewClient(t *testing.T) {
	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	cfg := config.KeycloakConfig{
		BaseURL:      "http://localhost:8080/auth",
		Realm:        "alfheim",
		ClientID:     "dashboard-backend",
		ClientSecret: "secret",
	}

	client := NewClient(cfg, testLogger)
	if client == nil {
		t.Fatal("expected non-nil Keycloak client")
	}
	if client.Gocloak == nil {
		t.Fatal("expected non-nil GoCloak instance inside client")
	}
}

func TestGetAdminToken_Cached(t *testing.T) {
	ctx := context.Background()
	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	cfg := config.KeycloakConfig{
		BaseURL: "http://localhost:8080/auth",
	}

	client := NewClient(cfg, testLogger)
	client.token = &gocloak.JWT{
		AccessToken: "test-cached-token-123",
	}
	client.tokenExpires = time.Now().Add(10 * time.Minute)

	token, err := client.GetAdminToken(ctx)
	if err != nil {
		t.Fatalf("expected no error when fetching cached admin token, got %v", err)
	}

	if token != "test-cached-token-123" {
		t.Errorf("expected cached token 'test-cached-token-123', got %s", token)
	}
}

func TestGetAdminToken_Unreachable(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	cfg := config.KeycloakConfig{
		BaseURL:      "http://127.0.0.1:54321/auth",
		Realm:        "alfheim",
		ClientID:     "dashboard-backend",
		ClientSecret: "secret",
	}

	client := NewClient(cfg, testLogger)

	_, err := client.GetAdminToken(ctx)
	if err == nil {
		t.Fatal("expected error when logging in with unreachable Keycloak server, got nil")
	}
}

func TestGetUserByID_Unreachable(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	cfg := config.KeycloakConfig{
		BaseURL:      "http://127.0.0.1:54321/auth",
		Realm:        "alfheim",
		ClientID:     "dashboard-backend",
		ClientSecret: "secret",
	}

	client := NewClient(cfg, testLogger)

	_, err := client.GetUserByID(ctx, "test-user-id")
	if err == nil {
		t.Fatal("expected error when fetching user with unreachable Keycloak server, got nil")
	}
}

func TestUpdateUser_Unreachable(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	cfg := config.KeycloakConfig{
		BaseURL:      "http://127.0.0.1:54321/auth",
		Realm:        "alfheim",
		ClientID:     "dashboard-backend",
		ClientSecret: "secret",
	}

	client := NewClient(cfg, testLogger)
	user := gocloak.User{
		ID: gocloak.StringP("test-user-id"),
	}

	err := client.UpdateUser(ctx, user)
	if err == nil {
		t.Fatal("expected error when updating user with unreachable Keycloak server, got nil")
	}
}

func TestKeycloakClient_Success(t *testing.T) {
	ctx := context.Background()
	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/realms/alfheim/protocol/openid-connect/token" {
			_ = json.NewEncoder(w).Encode(gocloak.JWT{
				AccessToken: "test-kc-admin-token",
				ExpiresIn:   3600,
			})
			return
		}
		if r.URL.Path == "/admin/realms/alfheim/users/u-100" {
			if r.Method == http.MethodGet {
				_ = json.NewEncoder(w).Encode(gocloak.User{
					ID:        gocloak.StringP("u-100"),
					Username:  gocloak.StringP("user100"),
					FirstName: gocloak.StringP("First"),
					LastName:  gocloak.StringP("Last"),
				})
				return
			}
			if r.Method == http.MethodPut {
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer ts.Close()

	cfg := config.KeycloakConfig{
		BaseURL:      ts.URL,
		Realm:        "alfheim",
		ClientID:     "client",
		ClientSecret: "secret",
	}

	client := NewClient(cfg, testLogger)

	// 1. GetAdminToken live login
	token, err := client.GetAdminToken(ctx)
	if err != nil {
		t.Fatalf("unexpected error getting admin token: %v", err)
	}
	if token != "test-kc-admin-token" {
		t.Errorf("expected test-kc-admin-token, got %s", token)
	}

	// 2. GetUserByID
	user, err := client.GetUserByID(ctx, "u-100")
	if err != nil {
		t.Fatalf("unexpected error getting user by id: %v", err)
	}
	if gocloak.PString(user.Username) != "user100" {
		t.Errorf("expected user100, got %s", gocloak.PString(user.Username))
	}

	// 3. UpdateUser
	err = client.UpdateUser(ctx, gocloak.User{ID: gocloak.StringP("u-100"), FirstName: gocloak.StringP("Updated")})
	if err != nil {
		t.Fatalf("unexpected error updating user: %v", err)
	}

	// 4. GetUserByID with not-found user
	_, err = client.GetUserByID(ctx, "u-not-found")
	if err == nil {
		t.Fatal("expected error for nonexistent user, got nil")
	}

	// 5. UpdateUser with not-found user
	err = client.UpdateUser(ctx, gocloak.User{ID: gocloak.StringP("u-not-found")})
	if err == nil {
		t.Fatal("expected error for nonexistent user update, got nil")
	}
}

func TestKeycloakClient_TokenFailureBranches(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	cfg := config.KeycloakConfig{
		BaseURL: "http://127.0.0.1:59999/auth",
	}
	client := NewClient(cfg, testLogger)

	t.Run("GetUserByID returns error when token fails", func(t *testing.T) {
		_, err := client.GetUserByID(ctx, "u-1")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("UpdateUser returns error when token fails", func(t *testing.T) {
		err := client.UpdateUser(ctx, gocloak.User{ID: gocloak.StringP("u-1")})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
