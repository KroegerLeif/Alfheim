package main

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/dashboard/config"
	"alfheim/dashboard/internal/features/apps"
	"alfheim/dashboard/internal/features/integrations/actions"
	"alfheim/dashboard/internal/features/integrations/homeassistant"
	"alfheim/dashboard/internal/features/plugins"
	"alfheim/go-shared/db"
	"alfheim/go-shared/netguard"
)

// integrationStack is the typed plugin framework (ADR 0010) with its concrete
// plugins and their feature routes, built once in run and passed to
// buildRouter.
type integrationStack struct {
	plugins *plugins.Service
	ha      homeassistant.Routes
	log     *slog.Logger
}

// register mounts the plugin API and the Home Assistant routes.
func (s *integrationStack) register(r chi.Router, authMw, householdMw func(http.Handler) http.Handler) {
	plugins.NewHandler(s.plugins, s.log).RegisterRoutes(r, authMw, householdMw)
	s.ha.Register(r, authMw, householdMw)
}

// newIntegrations wires the plugin framework. Concrete plugins get the
// netguard client from plugins.NewHTTPClient; calls to other Alfheim services
// (household, chores, the OIDC issuer) use a plain client with a timeout,
// because they are internal destinations the netguard would block.
//
// Without INTEGRATIONS_ENCRYPTION_KEY the dashboard still starts: listing and
// toggling plugins work, but storing or reading credentials fails closed.
// Without the service principal settings, plugin actions are switched off.
func newIntegrations(conn db.DBTX, cfg *config.Config, enabled apps.EnabledApps, log *slog.Logger) (*integrationStack, error) {
	ic := cfg.Integrations
	guard, err := netguard.New(ic.AllowedHosts)
	if err != nil {
		return nil, fmt.Errorf("INTEGRATIONS_ALLOWED_HOSTS: %w", err)
	}
	cipher, err := plugins.NewCipher(ic.EncryptionKey, ic.EncryptionKeyID)
	if err != nil {
		return nil, fmt.Errorf("INTEGRATIONS_ENCRYPTION_KEY: %w", err)
	}
	if !cipher.Available() {
		log.Warn("INTEGRATIONS_ENCRYPTION_KEY is not set; plugin credentials can be neither stored nor read")
	}

	internal := &http.Client{Timeout: plugins.DefaultTimeout}
	var (
		binder homeassistant.Binder
		tokens actions.TokenProvider
	)
	if ic.Principal.Configured() {
		binder = actions.NewBindingClient(cfg.Household.InternalURL, ic.Principal.PrincipalID, []string{actions.ChoresScope}, internal)
		tokens = actions.NewTokenSource(actions.PrincipalConfig{
			IssuerURL: cfg.OIDC.IssuerURL, ClientID: ic.Principal.ClientID,
			ClientSecret: ic.Principal.ClientSecret, ProjectID: ic.Principal.ProjectID,
		}, internal)
	} else {
		log.Warn("the integrations service principal is not configured; plugin actions are switched off")
	}

	haClient := plugins.NewHTTPClient(guard, plugins.DefaultTimeout)
	registry, err := plugins.NewRegistry(homeassistant.NewPlugin(haClient, binder))
	if err != nil {
		return nil, fmt.Errorf("plugin registry: %w", err)
	}
	svc := plugins.NewService(plugins.NewRepository(conn), registry, cipher, guard, plugins.DefaultTimeout)

	executors := map[string]actions.Executor{
		actions.ActionCreateChoreInstance: actions.NewChoresExecutor(ic.ChoresURL, enabled.Has("chores"), tokens, internal),
	}
	actionSvc := actions.NewService(actions.NewRepository(conn), executors, log)
	secrets := homeassistant.NewSecretStore(conn)
	return &integrationStack{
		plugins: svc,
		log:     log,
		ha: homeassistant.Routes{
			Member:  homeassistant.NewMemberHandler(svc, homeassistant.NewStates(svc, haClient), log),
			Proxy:   homeassistant.NewMCPProxy(svc, plugins.NewHTTPClient(guard, homeassistant.MCPTimeout), log),
			Secrets: homeassistant.NewSecretHandler(svc, secrets, cipher, log),
			Webhook: homeassistant.NewWebhook(svc, secrets, cipher, actionSvc, log),
			Rules:   actions.NewHandler(actionSvc, homeassistant.Type, log),
			Log:     log,
		},
	}, nil
}
