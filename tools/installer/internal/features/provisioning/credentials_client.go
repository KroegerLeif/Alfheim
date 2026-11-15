package provisioning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// This file implements zitadelauth.Admin on HTTPClient: the calls that let
// the provisioning machine user rotate its own machine key and revoke its
// personal access tokens (issue #789). They use the user.v2 service and
// reuse request's retry handling.

// WithToken returns a copy of c that authenticates with token instead, so a
// credential rotated mid-run is used for every later call.
func (c *HTTPClient) WithToken(token string) *HTTPClient {
	clone := *c
	clone.PAT = token
	return &clone
}

// CurrentUserID implements zitadelauth.Admin. It reads the sub claim of the
// OIDC userinfo endpoint, which answers for personal access tokens and for
// the machine key's access token alike (both carry the openid scope).
func (c *HTTPClient) CurrentUserID(ctx context.Context) (string, error) {
	respBody, err := c.request(ctx, http.MethodGet, userinfoPath, nil, "")
	if err != nil {
		return "", err
	}
	var parsed struct {
		Sub string `json:"sub"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", fmt.Errorf("provisioning: decode current user: %w", err)
	}
	if parsed.Sub == "" {
		return "", errors.New("provisioning: Zitadel returned no id for the current user")
	}
	return parsed.Sub, nil
}

// AddMachineKey implements zitadelauth.Admin. Zitadel generates the key
// pair and returns the key file, base64-encoded, exactly once.
func (c *HTTPClient) AddMachineKey(ctx context.Context, userID string, expires time.Time) (string, []byte, error) {
	body := map[string]any{
		"userId":         userID,
		"expirationDate": expires.UTC().Format(time.RFC3339),
	}
	var parsed struct {
		KeyID      string `json:"keyId"`
		KeyContent string `json:"keyContent"`
	}
	if err := c.call(ctx, userService, "AddKey", body, &parsed, ""); err != nil {
		return "", nil, err
	}
	keyJSON, err := base64.StdEncoding.DecodeString(parsed.KeyContent)
	if err != nil {
		return "", nil, fmt.Errorf("provisioning: decode machine key details: %w", err)
	}
	if parsed.KeyID == "" || len(keyJSON) == 0 {
		return "", nil, errors.New("provisioning: Zitadel returned an empty machine key")
	}
	return parsed.KeyID, keyJSON, nil
}

// ListMachineKeys implements zitadelauth.Admin.
func (c *HTTPClient) ListMachineKeys(ctx context.Context, userID string) ([]string, error) {
	return c.listUserCredentialIDs(ctx, "ListKeys", userID)
}

// RemoveMachineKey implements zitadelauth.Admin.
func (c *HTTPClient) RemoveMachineKey(ctx context.Context, userID, keyID string) error {
	return c.call(ctx, userService, "RemoveKey", map[string]any{"userId": userID, "keyId": keyID}, nil, "")
}

// ListPersonalAccessTokens implements zitadelauth.Admin.
func (c *HTTPClient) ListPersonalAccessTokens(ctx context.Context, userID string) ([]string, error) {
	return c.listUserCredentialIDs(ctx, "ListPersonalAccessTokens", userID)
}

// RemovePersonalAccessToken implements zitadelauth.Admin.
func (c *HTTPClient) RemovePersonalAccessToken(ctx context.Context, userID, tokenID string) error {
	body := map[string]any{"userId": userID, "tokenId": tokenID}
	return c.call(ctx, userService, "RemovePersonalAccessToken", body, nil, "")
}

// listUserCredentialIDs runs a user.v2 key or token listing restricted to one
// user and returns the id of every result.
func (c *HTTPClient) listUserCredentialIDs(ctx context.Context, method, userID string) ([]string, error) {
	body := map[string]any{
		"filters": []map[string]any{{"userIdFilter": map[string]any{"id": userID}}},
	}
	var parsed struct {
		Result []struct {
			ID     string `json:"id"`
			UserID string `json:"userId"`
		} `json:"result"`
	}
	if err := c.call(ctx, userService, method, body, &parsed, ""); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(parsed.Result))
	for _, r := range parsed.Result {
		// Defence in depth: never revoke another user's credential should the
		// filter ever be ignored.
		if r.UserID != "" && r.UserID != userID {
			continue
		}
		ids = append(ids, r.ID)
	}
	return ids, nil
}
