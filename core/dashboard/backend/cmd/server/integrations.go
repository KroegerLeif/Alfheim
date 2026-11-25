package main

import (
	"fmt"
	"log/slog"

	"alfheim/dashboard/config"
	"alfheim/dashboard/internal/features/plugins"
	"alfheim/go-shared/db"
	"alfheim/go-shared/netguard"
)

// newPluginService wires the typed plugin framework (ADR 0010). Concrete
// plugins are constructed here with the netguard client from
// plugins.NewHTTPClient(guard, plugins.DefaultTimeout) and passed to
// plugins.NewRegistry; this build registers none yet.
//
// Without INTEGRATIONS_ENCRYPTION_KEY the dashboard still starts: listing and
// toggling plugins work, but storing or reading credentials fails closed.
func newPluginService(conn db.DBTX, cfg config.IntegrationsConfig, log *slog.Logger) (*plugins.Service, error) {
	guard, err := netguard.New(cfg.AllowedHosts)
	if err != nil {
		return nil, fmt.Errorf("INTEGRATIONS_ALLOWED_HOSTS: %w", err)
	}
	registry, err := plugins.NewRegistry()
	if err != nil {
		return nil, fmt.Errorf("plugin registry: %w", err)
	}
	cipher, err := plugins.NewCipher(cfg.EncryptionKey, cfg.EncryptionKeyID)
	if err != nil {
		return nil, fmt.Errorf("INTEGRATIONS_ENCRYPTION_KEY: %w", err)
	}
	if !cipher.Available() {
		log.Warn("INTEGRATIONS_ENCRYPTION_KEY is not set; plugin credentials can be neither stored nor read")
	}
	return plugins.NewService(plugins.NewRepository(conn), registry, cipher, guard, plugins.DefaultTimeout), nil
}
