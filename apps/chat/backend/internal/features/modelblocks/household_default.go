package modelblocks

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"alfheim/chat/internal/shared/llm"
)

// HouseholdDefaultRequest is the body of PUT /api/v1/chat/model-blocks/household-default.
// It creates the household's default shared model block or replaces its
// settings. APIKey is write-only; omit it to keep the stored key.
type HouseholdDefaultRequest struct {
	DisplayName     string  `json:"display_name"`
	ProviderType    string  `json:"provider_type"`
	BaseURL         *string `json:"base_url,omitempty"`
	ModelIdentifier string  `json:"model_identifier"`
	APIKey          *string `json:"api_key,omitempty"`
	// ClearAPIKey removes a stored API key. Ignored if APIKey is also set.
	ClearAPIKey bool `json:"clear_api_key,omitempty"`
}

// defaultDisplayName names a household default block created without a name.
const defaultDisplayName = "ALFI"

// HouseholdDefault returns the household's default shared model block: the
// oldest block shared with householdID. Bootstrap blocks and private blocks
// never count. It fails with ErrNotFound when the household has none.
func (s *service) HouseholdDefault(ctx context.Context, userID, householdID string) (ResponseDTO, error) {
	m, err := s.householdDefault(ctx, userID, householdID)
	if err != nil {
		return ResponseDTO{}, err
	}
	return ToResponse(m, userID), nil
}

func (s *service) householdDefault(ctx context.Context, userID, householdID string) (*ModelBlock, error) {
	if householdID == "" {
		return nil, ErrMissingHouseholdID
	}
	blocks, err := s.repo.ListVisibleTo(ctx, userID, householdID)
	if err != nil {
		return nil, err
	}
	var oldest *ModelBlock
	for _, m := range blocks {
		if m.IsBootstrap || m.Visibility != VisibilityShared || m.HouseholdID == nil || *m.HouseholdID != householdID {
			continue
		}
		if oldest == nil || m.CreatedAt.Before(oldest.CreatedAt) {
			oldest = m
		}
	}
	if oldest == nil {
		return nil, ErrNotFound
	}
	return oldest, nil
}

// SaveHouseholdDefault creates or updates the household's default shared
// model block. The HTTP layer admits only OWNER and ADMIN of householdID (via
// household.RequireHouseholdRole), so they may change the block even when
// another member created it. created reports whether a new block was stored.
func (s *service) SaveHouseholdDefault(ctx context.Context, userID, householdID string, req HouseholdDefaultRequest) (ResponseDTO, bool, error) {
	if !llm.IsSupportedProviderType(req.ProviderType) {
		return ResponseDTO{}, false, ErrInvalidProviderType
	}
	if strings.TrimSpace(req.ModelIdentifier) == "" {
		return ResponseDTO{}, false, ErrModelIdentifierRequired
	}
	name := strings.TrimSpace(req.DisplayName)
	if name == "" {
		name = defaultDisplayName
	}

	m, err := s.householdDefault(ctx, userID, householdID)
	if errors.Is(err, ErrNotFound) {
		created, err := s.Create(ctx, userID, householdID, CreateRequest{
			DisplayName: name, ProviderType: req.ProviderType, BaseURL: req.BaseURL,
			ModelIdentifier: req.ModelIdentifier, APIKey: req.APIKey, Visibility: VisibilityShared,
		})
		return created, err == nil, err
	}
	if err != nil {
		return ResponseDTO{}, false, err
	}

	baseURL := req.BaseURL
	if baseURL == nil {
		empty := ""
		baseURL = &empty
	}
	m.ProviderType = req.ProviderType
	update := UpdateRequest{
		DisplayName: &name, BaseURL: baseURL, ModelIdentifier: &req.ModelIdentifier,
		APIKey: req.APIKey, ClearAPIKey: req.ClearAPIKey,
	}
	if err := s.applyUpdate(ctx, m, householdID, update); err != nil {
		return ResponseDTO{}, false, err
	}
	if err := s.repo.Update(ctx, m); err != nil {
		return ResponseDTO{}, false, err
	}
	s.log.Info("updated household default model block",
		slog.String("id", m.ID), slog.String("household_id", householdID), slog.String("actor_user_id", userID))
	return ToResponse(m, userID), false, nil
}
