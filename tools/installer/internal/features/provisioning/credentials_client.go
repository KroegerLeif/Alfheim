package provisioning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// This file implements zitadelauth.Admin on HTTPClient: the calls that let
// the provisioning machine user rotate its own machine key and revoke its
// personal access tokens (issue #789). They reuse request's retry handling.

// WithToken returns a copy of c that authenticates with token instead, so a
// credential rotated mid-run is used for every later call.
func (c *HTTPClient) WithToken(token string) *HTTPClient {
	clone := *c
	clone.PAT = token
	return &clone
}

// CurrentUserID implements zitadelauth.Admin.
func (c *HTTPClient) CurrentUserID(ctx context.Context) (string, error) {
	respBody, err := c.request(ctx, http.MethodGet, "/auth/v1/users/me", nil, "")
	if err != nil {
		return "", err
	}
	var parsed struct {
		User struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", fmt.Errorf("provisioning: decode current user: %w", err)
	}
	if parsed.User.ID == "" {
		return "", errors.New("provisioning: Zitadel returned no id for the current user")
	}
	return parsed.User.ID, nil
}

// AddMachineKey implements zitadelauth.Admin. Zitadel generates the key
// pair and returns the key file, base64-encoded, exactly once.
func (c *HTTPClient) AddMachineKey(ctx context.Context, userID string, expires time.Time) (string, []byte, error) {
	body := map[string]any{
		"type":           "KEY_TYPE_JSON",
		"expirationDate": expires.UTC().Format(time.RFC3339),
	}
	respBody, err := c.request(ctx, http.MethodPost, userPath(userID, "keys"), body, "")
	if err != nil {
		return "", nil, err
	}
	var parsed struct {
		KeyID      string `json:"keyId"`
		KeyDetails string `json:"keyDetails"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", nil, fmt.Errorf("provisioning: decode new machine key: %w", err)
	}
	keyJSON, err := base64.StdEncoding.DecodeString(parsed.KeyDetails)
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
	return c.listIDs(ctx, userPath(userID, "keys/_search"))
}

// RemoveMachineKey implements zitadelauth.Admin.
func (c *HTTPClient) RemoveMachineKey(ctx context.Context, userID, keyID string) error {
	_, err := c.request(ctx, http.MethodDelete, userPath(userID, "keys/"+url.PathEscape(keyID)), nil, "")
	return err
}

// ListPersonalAccessTokens implements zitadelauth.Admin.
func (c *HTTPClient) ListPersonalAccessTokens(ctx context.Context, userID string) ([]string, error) {
	return c.listIDs(ctx, userPath(userID, "pats/_search"))
}

// RemovePersonalAccessToken implements zitadelauth.Admin.
func (c *HTTPClient) RemovePersonalAccessToken(ctx context.Context, userID, tokenID string) error {
	_, err := c.request(ctx, http.MethodDelete, userPath(userID, "pats/"+url.PathEscape(tokenID)), nil, "")
	return err
}

// listIDs runs a Management API search and returns the id of every result.
func (c *HTTPClient) listIDs(ctx context.Context, path string) ([]string, error) {
	respBody, err := c.request(ctx, http.MethodPost, path, map[string]any{}, "")
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Result []struct {
			ID string `json:"id"`
		} `json:"result"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("provisioning: decode %s: %w", path, err)
	}
	ids := make([]string, 0, len(parsed.Result))
	for _, r := range parsed.Result {
		ids = append(ids, r.ID)
	}
	return ids, nil
}

// userPath builds a Management API path below one user.
func userPath(userID, rest string) string {
	return "/management/v1/users/" + url.PathEscape(userID) + "/" + rest
}
