package actions

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"alfheim/dashboard/internal/features/plugins"
)

// ErrBinding means the household API refused or failed a binding change.
var ErrBinding = errors.New("service binding change failed")

// BindingClient creates and removes the binding between a household and the
// integrations service principal on core/household's public API (#958). It
// calls as the OWNER or ADMIN who switched the plugin, with their token, so
// the household API checks their role itself.
type BindingClient struct {
	baseURL     string
	principalID string
	scopes      []string
	client      *http.Client
}

// NewBindingClient returns a client for the household API at baseURL that
// binds principalID with scopes.
func NewBindingClient(baseURL, principalID string, scopes []string, client *http.Client) *BindingClient {
	return &BindingClient{baseURL: strings.TrimRight(baseURL, "/"), principalID: principalID, scopes: scopes, client: client}
}

// Bind creates or updates the household's binding.
func (c *BindingClient) Bind(ctx context.Context, change plugins.EnableChange) error {
	body, err := json.Marshal(map[string]any{"principal_id": c.principalID, "scopes": c.scopes})
	if err != nil {
		return fmt.Errorf("%w: encode binding: %w", ErrBinding, err)
	}
	path := "/api/v1/households/" + url.PathEscape(change.HouseholdID.String()) + "/service-bindings"
	return c.call(ctx, http.MethodPost, path, change.CallerToken, body, http.StatusOK, http.StatusCreated)
}

// Unbind removes the household's binding; a binding that is already gone is
// not an error.
func (c *BindingClient) Unbind(ctx context.Context, change plugins.EnableChange) error {
	path := "/api/v1/households/" + url.PathEscape(change.HouseholdID.String()) +
		"/service-bindings/" + url.PathEscape(c.principalID)
	return c.call(ctx, http.MethodDelete, path, change.CallerToken, nil, http.StatusNoContent, http.StatusNotFound)
}

func (c *BindingClient) call(ctx context.Context, method, path, token string, body []byte, ok ...int) error {
	if token == "" {
		return fmt.Errorf("%w: no caller token", ErrBinding)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("%w: build request: %w", ErrBinding, err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrBinding, err)
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
	for _, status := range ok {
		if resp.StatusCode == status {
			return nil
		}
	}
	return fmt.Errorf("%w: household API answered %d", ErrBinding, resp.StatusCode)
}
