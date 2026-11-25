package main

import (
	"bytes"
	"io"
	"log/slog"
	"slices"
	"strings"
	"testing"

	"alfheim/dashboard/config"
	"alfheim/dashboard/internal/features/apps"
	"alfheim/dashboard/internal/features/integrations/homeassistant"
)

func discardLogger() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// testPluginService is the integration stack of a router under test: no
// database, no key, an empty allowlist and no service principal.
func testPluginService(t *testing.T) *integrationStack {
	t.Helper()
	s, err := newIntegrations(nil, &config.Config{}, apps.AllApps(), discardLogger())
	if err != nil {
		t.Fatalf("newIntegrations: %v", err)
	}
	return s
}

func TestNewIntegrations_WarnsWithoutKeyAndPrincipal(t *testing.T) {
	var logs bytes.Buffer
	cfg := &config.Config{Integrations: config.IntegrationsConfig{EncryptionKeyID: "v1"}}
	s, err := newIntegrations(nil, cfg, apps.AllApps(), slog.New(slog.NewTextHandler(&logs, nil)))
	if err != nil {
		t.Fatal(err)
	}
	if s.plugins.EncryptionAvailable() || !strings.Contains(logs.String(), "INTEGRATIONS_ENCRYPTION_KEY") {
		t.Errorf("a missing key must be logged and leave encryption unavailable; logs: %s", logs.String())
	}
	if !strings.Contains(logs.String(), "service principal is not configured") {
		t.Errorf("a missing principal must be logged; logs: %s", logs.String())
	}
	if got := s.plugins.Registry().Types(); !slices.Equal(got, []string{homeassistant.Type, "jellyfin", "navidrome"}) {
		t.Errorf("expected the Home Assistant and media plugins, got %v", got)
	}
}

func TestNewIntegrations_WithKeyAndPrincipal(t *testing.T) {
	cfg := &config.Config{Integrations: config.IntegrationsConfig{
		EncryptionKey: bytes.Repeat([]byte{7}, 32), EncryptionKeyID: "v1", AllowedHosts: "10.0.0.0/8",
		Principal: config.PrincipalConfig{PrincipalID: "p", ClientID: "c", ClientSecret: "s", ProjectID: "proj"},
	}}
	var logs bytes.Buffer
	s, err := newIntegrations(nil, cfg, apps.ParseEnabledApps(""), slog.New(slog.NewTextHandler(&logs, nil)))
	if err != nil || !s.plugins.EncryptionAvailable() {
		t.Fatalf("s=%v err=%v", s, err)
	}
	if strings.Contains(logs.String(), "service principal") || strings.Contains(logs.String(), "s\"") {
		t.Errorf("a configured principal logs nothing; logs: %s", logs.String())
	}
}

func TestNewIntegrations_RejectsBadSettings(t *testing.T) {
	for name, ic := range map[string]config.IntegrationsConfig{
		"allowlist": {AllowedHosts: "10.0.0.0/99"},
		"key size":  {EncryptionKey: []byte("short"), EncryptionKeyID: "v1"},
		"key id":    {EncryptionKey: bytes.Repeat([]byte{7}, 32)},
	} {
		if _, err := newIntegrations(nil, &config.Config{Integrations: ic}, apps.AllApps(), discardLogger()); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}
