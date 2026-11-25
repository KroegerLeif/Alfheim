package plugins

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"alfheim/go-shared/netguard"
)

// This file is the service API that other dashboard features (the Home
// Assistant MCP proxy and webhook, the media server status, the ALFI card) use
// to reach a household's plugin. They declare a narrow interface over these
// methods next to their own code and receive *Service from main.

// Instance loads the household's plugin of pluginType with its decrypted
// credentials, whether enabled or not. It fails with ErrUnknownType,
// ErrNotConfigured, ErrEncryptionUnavailable or ErrKeyMismatch.
func (s *Service) Instance(ctx context.Context, householdID uuid.UUID, pluginType string) (Instance, error) {
	if _, ok := s.registry.Get(pluginType); !ok {
		return Instance{}, ErrUnknownType
	}
	rec, err := s.repo.Get(ctx, householdID, pluginType)
	if err != nil {
		return Instance{}, err
	}
	creds, err := s.cipher.Open(rec.CredentialsEncrypted, rec.CredentialsKeyID)
	if err != nil {
		return Instance{}, err
	}
	return Instance{
		HouseholdID: householdID,
		Type:        pluginType,
		Enabled:     rec.Enabled,
		Config:      rec.pluginConfig(),
		Credentials: creds,
	}, nil
}

// EnabledInstance is Instance for an outbound call: it also fails with
// ErrDisabled when the household switched the plugin off, and with
// ErrHostNotAllowed when the base URL is outside INTEGRATIONS_ALLOWED_HOSTS.
// The netguard client checks the address again when it connects.
func (s *Service) EnabledInstance(ctx context.Context, householdID uuid.UUID, pluginType string) (Instance, error) {
	inst, err := s.Instance(ctx, householdID, pluginType)
	if err != nil {
		return Instance{}, err
	}
	if !inst.Enabled {
		return Instance{}, ErrDisabled
	}
	if err := s.checkURL(ctx, inst.Config.BaseURL); err != nil {
		return Instance{}, err
	}
	return inst, nil
}

// IsEnabled reports whether the household has pluginType configured and
// switched on, without decrypting its credentials. An unconfigured plugin is
// not enabled; an unregistered type fails with ErrUnknownType.
func (s *Service) IsEnabled(ctx context.Context, householdID uuid.UUID, pluginType string) (bool, error) {
	if _, ok := s.registry.Get(pluginType); !ok {
		return false, ErrUnknownType
	}
	rec, err := s.repo.Get(ctx, householdID, pluginType)
	if errors.Is(err, ErrNotConfigured) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return rec.Enabled, nil
}

// Registry returns the registry, so features can look up a capability with
// CapabilityOf.
func (s *Service) Registry() *Registry {
	return s.registry
}

func isBlocked(err error) bool {
	return errors.Is(err, netguard.ErrBlocked)
}
