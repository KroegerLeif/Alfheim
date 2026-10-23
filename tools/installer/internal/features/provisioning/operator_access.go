package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
)

// zitadelNoChangesMessage is the text Zitadel answers an update with when it
// would not change anything. Unlike the app config update, the project update
// has no id this code relies on, so the message itself is matched.
const zitadelNoChangesMessage = "No changes"

// isConflict reports whether err is a Zitadel API answer of HTTP 409, which
// create endpoints return for an object that already exists.
func isConflict(err error) bool {
	var apiErr *apiError
	return errors.As(err, &apiErr) && apiErr.status == http.StatusConflict
}

type projectResponse struct {
	Project map[string]any `json:"project"`
}

// EnsureRoleAssertion implements Client.
//
// With projectRoleAssertion on, Zitadel adds the user's roles of the project
// to the tokens of every application in it, independent of the scopes the
// client requests. projectRoleCheck and hasProjectCheck are deliberately left
// as they are: turning either on would lock every user without a grant out of
// the whole stack.
func (c *HTTPClient) EnsureRoleAssertion(ctx context.Context, projectID string) error {
	path := fmt.Sprintf("/management/v1/projects/%s", projectID)
	respBody, err := c.request(ctx, http.MethodGet, path, nil, "")
	if err != nil {
		return err
	}
	var decoded projectResponse
	if err := json.Unmarshal(respBody, &decoded); err != nil {
		return fmt.Errorf("provisioning: decode project response: %w", err)
	}
	if decoded.Project == nil {
		return fmt.Errorf("provisioning: %s returned no project", path)
	}
	if asserted, _ := decoded.Project["projectRoleAssertion"].(bool); asserted {
		return nil
	}

	// A PUT replaces the whole project, so the settings that stay as they
	// are must be sent back.
	body := map[string]any{"projectRoleAssertion": true}
	for _, key := range []string{"name", "projectRoleCheck", "hasProjectCheck", "privateLabelingSetting"} {
		if v, ok := decoded.Project[key]; ok {
			body[key] = v
		}
	}
	_, err = c.request(ctx, http.MethodPut, path, body, zitadelNoChangesMessage)
	return err
}

// EnsureProjectRole implements Client.
func (c *HTTPClient) EnsureProjectRole(ctx context.Context, projectID string, role RoleSpec) error {
	searchBody := map[string]any{
		"queries": []map[string]any{
			{"keyQuery": map[string]any{"key": role.Key, "method": "TEXT_QUERY_METHOD_EQUALS"}},
		},
	}
	respBody, err := c.request(ctx,
		http.MethodPost, fmt.Sprintf("/management/v1/projects/%s/roles/_search", projectID), searchBody, "")
	if err != nil {
		return err
	}
	var search struct {
		Result []struct {
			Key string `json:"key"`
		} `json:"result"`
	}
	if err := json.Unmarshal(respBody, &search); err != nil {
		return fmt.Errorf("provisioning: decode role search response: %w", err)
	}
	for _, r := range search.Result {
		if r.Key == role.Key {
			return nil
		}
	}

	createBody := map[string]any{
		"roleKey":     role.Key,
		"displayName": role.DisplayName,
		"group":       role.Group,
	}
	_, err = c.request(ctx,
		http.MethodPost, fmt.Sprintf("/management/v1/projects/%s/roles", projectID), createBody, "")
	if isConflict(err) {
		return nil // created in the meantime
	}
	return err
}

// GrantProjectRole implements Client.
func (c *HTTPClient) GrantProjectRole(ctx context.Context, projectID, userName, roleKey string) error {
	userID, err := c.findUserID(ctx, userName)
	if err != nil {
		return err
	}

	searchBody := map[string]any{
		"queries": []map[string]any{
			{"userIdQuery": map[string]any{"userId": userID}},
			{"projectIdQuery": map[string]any{"projectId": projectID}},
		},
	}
	respBody, err := c.request(ctx, http.MethodPost, "/management/v1/users/grants/_search", searchBody, "")
	if err != nil {
		return err
	}
	var search struct {
		Result []struct {
			ID        string   `json:"id"`
			UserID    string   `json:"userId"`
			ProjectID string   `json:"projectId"`
			RoleKeys  []string `json:"roleKeys"`
		} `json:"result"`
	}
	if err := json.Unmarshal(respBody, &search); err != nil {
		return fmt.Errorf("provisioning: decode user grant search response: %w", err)
	}

	for _, g := range search.Result {
		if g.UserID != userID || g.ProjectID != projectID || g.ID == "" {
			continue
		}
		if slices.Contains(g.RoleKeys, roleKey) {
			return nil
		}
		// The user already holds other roles here: add to them, never
		// replace.
		roleKeys := append(slices.Clone(g.RoleKeys), roleKey)
		_, err := c.request(ctx, http.MethodPut,
			fmt.Sprintf("/management/v1/users/%s/grants/%s", userID, g.ID),
			map[string]any{"roleKeys": roleKeys}, zitadelNoChangesMessage)
		return err
	}

	_, err = c.request(ctx, http.MethodPost, fmt.Sprintf("/management/v1/users/%s/grants", userID),
		map[string]any{"projectId": projectID, "roleKeys": []string{roleKey}}, "")
	if isConflict(err) {
		return nil // granted in the meantime
	}
	return err
}

// findUserID resolves a user name of the bootstrap PAT's organisation to the
// user id.
func (c *HTTPClient) findUserID(ctx context.Context, userName string) (string, error) {
	searchBody := map[string]any{
		"queries": []map[string]any{
			{"userNameQuery": map[string]any{"userName": userName, "method": "TEXT_QUERY_METHOD_EQUALS"}},
		},
	}
	respBody, err := c.request(ctx, http.MethodPost, "/management/v1/users/_search", searchBody, "")
	if err != nil {
		return "", err
	}
	var search struct {
		Result []struct {
			ID       string `json:"id"`
			UserName string `json:"userName"`
		} `json:"result"`
	}
	if err := json.Unmarshal(respBody, &search); err != nil {
		return "", fmt.Errorf("provisioning: decode user search response: %w", err)
	}
	for _, u := range search.Result {
		if u.UserName == userName && u.ID != "" {
			return u.ID, nil
		}
	}
	return "", fmt.Errorf("provisioning: no Zitadel user named %q in the organisation", userName)
}
