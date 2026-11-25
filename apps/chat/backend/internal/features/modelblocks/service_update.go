package modelblocks

import (
	"context"
	"log/slog"
	"strings"

	"alfheim/chat/internal/shared/llm"
)

// Update changes a model block; only its owner may do so.
func (s *service) Update(ctx context.Context, userID, householdID, id string, req UpdateRequest) (ResponseDTO, error) {
	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ResponseDTO{}, err
	}
	if m.IsBootstrap {
		return ResponseDTO{}, ErrBootstrapReadOnly
	}
	if !m.CanModify(userID) {
		return ResponseDTO{}, ErrForbidden
	}
	if err := s.applyUpdate(ctx, m, householdID, req); err != nil {
		return ResponseDTO{}, err
	}
	if err := s.repo.Update(ctx, m); err != nil {
		return ResponseDTO{}, err
	}

	s.log.Info("updated model block", slog.String("id", m.ID), slog.String("actor_user_id", userID))
	return ToResponse(m, userID), nil
}

// applyUpdate applies the non-nil fields of req to m. A base URL change is
// validated against the netguard allowlist and needs a new or cleared API key,
// so a stored key is never sent to another host. The caller checks permissions
// and persists m.
func (s *service) applyUpdate(ctx context.Context, m *ModelBlock, householdID string, req UpdateRequest) error {
	if req.DisplayName != nil {
		m.DisplayName = *req.DisplayName
	}
	baseURLChanged := false
	if req.BaseURL != nil {
		next := req.BaseURL
		if m.ProviderType == llm.ProviderTypeOllama || m.ProviderType == "ollama" {
			if strings.TrimSpace(*req.BaseURL) == "" {
				defaultURL := llm.DefaultOllamaBaseURL
				next = &defaultURL
			} else {
				normalized := llm.NormalizeOllamaBaseURL(*req.BaseURL)
				next = &normalized
			}
		}
		baseURLChanged = !sameBaseURL(m.BaseURL, next)
		if baseURLChanged {
			if err := s.validateBaseURL(ctx, next); err != nil {
				return err
			}
			// The stored key was issued for the previous endpoint. Sending it to a
			// different host would disclose it, so the caller must replace or drop it.
			newKeySupplied := req.APIKey != nil && *req.APIKey != ""
			if m.HasAPIKey() && !newKeySupplied && !req.ClearAPIKey {
				return ErrAPIKeyRequiredForBaseURLChange
			}
		}
		m.BaseURL = next
	}
	if req.ModelIdentifier != nil {
		m.ModelIdentifier = *req.ModelIdentifier
	}
	if req.ConfigJSON != nil {
		m.ConfigJSON = normalizeConfigJSON(req.ConfigJSON)
	}

	if req.Visibility != nil {
		switch *req.Visibility {
		case VisibilityPrivate:
			m.Visibility = VisibilityPrivate
			m.HouseholdID = nil
		case VisibilityShared:
			if householdID == "" {
				return ErrMissingHouseholdID
			}
			m.Visibility = VisibilityShared
			m.HouseholdID = &householdID
		default:
			return ErrInvalidVisibility
		}
	}

	switch {
	case req.APIKey != nil && *req.APIKey != "":
		encryptedKey, err := s.encryptAPIKey(req.APIKey)
		if err != nil {
			return err
		}
		m.APIKeyEncrypted = encryptedKey
		m.APIKeyKeyID = s.encryptionKeyID
	case req.ClearAPIKey:
		m.APIKeyEncrypted = nil
	}
	return nil
}

// sameBaseURL reports whether two optional base URLs address the same endpoint,
// ignoring case and trailing slashes.
func sameBaseURL(a, b *string) bool {
	norm := func(p *string) string {
		if p == nil {
			return ""
		}
		return strings.ToLower(strings.TrimRight(strings.TrimSpace(*p), "/"))
	}
	return norm(a) == norm(b)
}
