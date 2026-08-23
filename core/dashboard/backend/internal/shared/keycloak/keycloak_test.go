package keycloak

import (
	"context"
	"io"
	"log/slog"
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
