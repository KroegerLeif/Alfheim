package main

import (
	"bytes"
	"io"
	"log/slog"
	"strings"
	"testing"

	"alfheim/dashboard/config"
	"alfheim/dashboard/internal/features/plugins"
)

// testPluginService is the plugin service of a router under test: no database,
// no key and an empty allowlist.
func testPluginService(t *testing.T) *plugins.Service {
	t.Helper()
	svc, err := newPluginService(nil, config.IntegrationsConfig{}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("newPluginService: %v", err)
	}
	return svc
}

func TestNewPluginService_WarnsWithoutKey(t *testing.T) {
	var logs bytes.Buffer
	svc, err := newPluginService(nil, config.IntegrationsConfig{EncryptionKeyID: "v1"}, slog.New(slog.NewTextHandler(&logs, nil)))
	if err != nil {
		t.Fatal(err)
	}
	if svc.EncryptionAvailable() || !strings.Contains(logs.String(), "INTEGRATIONS_ENCRYPTION_KEY") {
		t.Errorf("a missing key must be logged and leave encryption unavailable; logs: %s", logs.String())
	}
	if len(svc.Registry().Types()) != 0 {
		t.Errorf("this build registers no concrete plugin, got %v", svc.Registry().Types())
	}
}

func TestNewPluginService_WithKey(t *testing.T) {
	cfg := config.IntegrationsConfig{EncryptionKey: bytes.Repeat([]byte{7}, 32), EncryptionKeyID: "v1", AllowedHosts: "10.0.0.0/8"}
	svc, err := newPluginService(nil, cfg, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil || !svc.EncryptionAvailable() {
		t.Fatalf("svc=%v err=%v", svc, err)
	}
}

func TestNewPluginService_RejectsBadSettings(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	for name, cfg := range map[string]config.IntegrationsConfig{
		"allowlist": {AllowedHosts: "10.0.0.0/99"},
		"key size":  {EncryptionKey: []byte("short"), EncryptionKeyID: "v1"},
		"key id":    {EncryptionKey: bytes.Repeat([]byte{7}, 32)},
	} {
		if _, err := newPluginService(nil, cfg, log); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}
