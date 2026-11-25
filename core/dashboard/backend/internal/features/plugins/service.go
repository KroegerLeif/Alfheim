package plugins

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Service manages the plugins of one household at a time. Callers pass the
// household confirmed by household.RequireHousehold; role checks happen in the
// HTTP layer (household.RequireHouseholdRole). Other features use the methods
// in access.go to reach a household's plugin.
type Service struct {
	repo     Repository
	registry *Registry
	cipher   *Cipher
	guard    URLGuard
	timeout  time.Duration
	now      func() time.Time
}

// NewService returns the plugin service. guard checks every base URL before a
// plugin is called; timeout bounds each health check (DefaultTimeout when zero).
func NewService(repo Repository, registry *Registry, cipher *Cipher, guard URLGuard, timeout time.Duration) *Service {
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	return &Service{repo: repo, registry: registry, cipher: cipher, guard: guard, timeout: timeout, now: time.Now}
}

// EncryptionAvailable reports whether credentials can be stored and read.
func (s *Service) EncryptionAvailable() bool {
	return s.cipher.Available()
}

// List returns every registered plugin type merged with the household's rows.
// Rows of types this build no longer registers are left out.
func (s *Service) List(ctx context.Context, householdID uuid.UUID) ([]View, error) {
	rows, err := s.repo.List(ctx, householdID)
	if err != nil {
		return nil, err
	}
	byType := make(map[string]Record, len(rows))
	for _, rec := range rows {
		byType[rec.Type] = rec
	}
	types := s.registry.Types()
	views := make([]View, 0, len(types))
	for _, t := range types {
		rec, ok := byType[t]
		views = append(views, View{Type: t, Configured: ok, Record: rec})
	}
	return views, nil
}

// Save validates req and stores it as the household's configuration of
// pluginType. Stored credentials are kept unless req carries new ones.
func (s *Service) Save(ctx context.Context, householdID uuid.UUID, pluginType string, req UpdateRequest) (View, error) {
	plugin, ok := s.registry.Get(pluginType)
	if !ok {
		return View{}, ErrUnknownType
	}
	req.normalize()
	if verr := req.Validate(); verr != nil {
		return View{}, verr
	}
	if err := plugin.ValidateConfig(Config{BaseURL: req.BaseURL, Settings: req.Config}); err != nil {
		var verr *ValidationError
		if errors.As(err, &verr) {
			return View{}, verr
		}
		return View{}, NewValidationError("config", err.Error())
	}

	rec, err := s.repo.Get(ctx, householdID, pluginType)
	if err != nil && !errors.Is(err, ErrNotConfigured) {
		return View{}, err
	}
	wasEnabled := rec.Enabled
	rec.HouseholdID, rec.Type = householdID, pluginType
	rec.Enabled, rec.BaseURL, rec.Config = req.Enabled, req.BaseURL, req.Config
	if req.Credentials != nil {
		if err := s.sealInto(&rec, *req.Credentials); err != nil {
			return View{}, err
		}
	}
	if err := notifyEnableChange(ctx, plugin, wasEnabled, rec); err != nil {
		return View{}, err
	}
	if err := s.repo.Upsert(ctx, &rec); err != nil {
		return View{}, err
	}
	return View{Type: pluginType, Configured: true, Record: rec}, nil
}

// sealInto encrypts creds into rec; empty credentials clear the stored ones.
func (s *Service) sealInto(rec *Record, creds Credentials) error {
	if len(creds) == 0 {
		rec.CredentialsEncrypted, rec.CredentialsKeyID = nil, ""
		return nil
	}
	sealed, keyID, err := s.cipher.Seal(creds)
	if err != nil {
		return err
	}
	rec.CredentialsEncrypted, rec.CredentialsKeyID = sealed, keyID
	return nil
}

// Test runs the plugin's health check against the stored configuration and
// stores the result. A base URL outside the allowlist fails with
// StatusHostNotAllowed before any request is made.
func (s *Service) Test(ctx context.Context, householdID uuid.UUID, pluginType string) (View, error) {
	plugin, ok := s.registry.Get(pluginType)
	if !ok {
		return View{}, ErrUnknownType
	}
	rec, err := s.repo.Get(ctx, householdID, pluginType)
	if err != nil {
		return View{}, err
	}
	health := s.check(ctx, plugin, rec)
	result := HealthResult{Status: health.Status, Detail: health.Detail, CheckedAt: s.now().UTC()}
	if err := s.repo.SaveHealth(ctx, householdID, pluginType, result); err != nil {
		return View{}, err
	}
	rec.HealthStatus, rec.HealthDetail = result.Status, result.Detail
	rec.HealthCheckedAt = &result.CheckedAt
	return View{Type: pluginType, Configured: true, Record: rec}, nil
}

func (s *Service) check(ctx context.Context, plugin Plugin, rec Record) Health {
	creds, err := s.cipher.Open(rec.CredentialsEncrypted, rec.CredentialsKeyID)
	if err != nil {
		return Health{Status: StatusCredentialsUnavailable, Detail: credentialsDetail(err)}
	}
	cfg := rec.pluginConfig()
	if err := s.checkURL(ctx, cfg.BaseURL); err != nil {
		if errors.Is(err, ErrHostNotAllowed) {
			return HealthFromError(err)
		}
		return Health{Status: StatusUnreachable, Detail: "the address could not be resolved"}
	}
	checkCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	h := plugin.HealthCheck(checkCtx, cfg, creds)
	if h.Status == "" {
		h.Status = StatusError
	}
	h.Detail = SanitizeDetail(h.Detail, creds)
	return h
}

// checkURL validates a non-empty base URL against the netguard allowlist.
func (s *Service) checkURL(ctx context.Context, baseURL string) error {
	if baseURL == "" {
		return nil
	}
	if err := s.guard.ValidateURL(ctx, baseURL); err != nil {
		if isBlocked(err) {
			return fmt.Errorf("%w: %w", ErrHostNotAllowed, err)
		}
		return fmt.Errorf("validate plugin base url: %w", err)
	}
	return nil
}

func credentialsDetail(err error) string {
	switch {
	case errors.Is(err, ErrEncryptionUnavailable):
		return "INTEGRATIONS_ENCRYPTION_KEY is not configured"
	case errors.Is(err, ErrKeyMismatch):
		return "the credentials were encrypted with another key; enter them again"
	default:
		return "the stored credentials could not be decrypted; enter them again"
	}
}
