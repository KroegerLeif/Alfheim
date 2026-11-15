package provisioning

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
)

// zitadelNoChangesMessage is the text Zitadel answers an update with when it
// would not change anything. Some updates carry no id this code relies on, so
// the message itself is matched.
const zitadelNoChangesMessage = "No changes"

// isConflict reports whether err is a Zitadel API answer of HTTP 409, which
// create endpoints return for an object that already exists.
func isConflict(err error) bool {
	var apiErr *apiError
	return errors.As(err, &apiErr) && apiErr.status == http.StatusConflict
}

// EnsureRoleAssertion implements Client.
//
// With projectRoleAssertion on, Zitadel adds the user's roles of the project
// to the tokens of every application in it, independent of the scopes the
// client requests. projectRoleCheck and hasProjectCheck are deliberately left
// as they are: turning either on would lock every user without a grant out of
// the whole stack. The v2 update only changes the fields it is sent.
func (c *HTTPClient) EnsureRoleAssertion(ctx context.Context, projectID string) error {
	project, err := c.getProject(ctx, projectID)
	if err != nil {
		return err
	}
	if project.ProjectRoleAssertion {
		return nil
	}
	body := map[string]any{"projectId": projectID, "projectRoleAssertion": true}
	return c.call(ctx, projectService, "UpdateProject", body, nil, zitadelNoChangesMessage)
}

// EnsureProjectRole implements Client.
func (c *HTTPClient) EnsureProjectRole(ctx context.Context, projectID string, role RoleSpec) error {
	listBody := map[string]any{
		"projectId": projectID,
		"filters": []map[string]any{
			{"roleKeyFilter": map[string]any{"key": role.Key, "method": "TEXT_FILTER_METHOD_EQUALS"}},
		},
	}
	var list struct {
		ProjectRoles []struct {
			Key string `json:"key"`
		} `json:"projectRoles"`
	}
	if err := c.call(ctx, projectService, "ListProjectRoles", listBody, &list, ""); err != nil {
		return err
	}
	for _, r := range list.ProjectRoles {
		if r.Key == role.Key {
			return nil
		}
	}

	createBody := map[string]any{
		"projectId":   projectID,
		"roleKey":     role.Key,
		"displayName": role.DisplayName,
		"group":       role.Group,
	}
	err := c.call(ctx, projectService, "AddProjectRole", createBody, nil, "")
	if isConflict(err) {
		return nil // created in the meantime
	}
	return err
}

// authorization is the subset of a v2 authorization (formerly user grant)
// GrantProjectRole reads.
type authorization struct {
	ID   string `json:"id"`
	User struct {
		ID string `json:"id"`
	} `json:"user"`
	Project struct {
		ID string `json:"id"`
	} `json:"project"`
	Roles []struct {
		Key string `json:"key"`
	} `json:"roles"`
}

func (a authorization) roleKeys() []string {
	keys := make([]string, 0, len(a.Roles))
	for _, r := range a.Roles {
		keys = append(keys, r.Key)
	}
	return keys
}

// GrantProjectRole implements Client.
//
// An existing authorization of the user on the project is extended with
// roleKey; other roles the user holds there are kept.
func (c *HTTPClient) GrantProjectRole(ctx context.Context, projectID, userName, roleKey string) error {
	project, err := c.getProject(ctx, projectID)
	if err != nil {
		return err
	}
	userID, err := c.findUserID(ctx, project.OrganizationID, userName)
	if err != nil {
		return err
	}

	listBody := map[string]any{
		"filters": []map[string]any{
			{"inUserIds": map[string]any{"ids": []string{userID}}},
			{"projectId": map[string]any{"id": projectID}},
		},
	}
	var list struct {
		Authorizations []authorization `json:"authorizations"`
	}
	if err := c.call(ctx, authorizationService, "ListAuthorizations", listBody, &list, ""); err != nil {
		return err
	}

	for _, a := range list.Authorizations {
		if a.User.ID != userID || a.Project.ID != projectID || a.ID == "" {
			continue
		}
		current := a.roleKeys()
		if slices.Contains(current, roleKey) {
			return nil
		}
		updateBody := map[string]any{"id": a.ID, "roleKeys": append(current, roleKey)}
		return c.call(ctx, authorizationService, "UpdateAuthorization", updateBody, nil, zitadelNoChangesMessage)
	}

	createBody := map[string]any{
		"userId":         userID,
		"projectId":      projectID,
		"organizationId": project.OrganizationID,
		"roleKeys":       []string{roleKey},
	}
	err = c.call(ctx, authorizationService, "CreateAuthorization", createBody, nil, "")
	if isConflict(err) {
		return nil // granted in the meantime
	}
	return err
}

// findUserID resolves an organisation user's id from its user name (for the
// operator: the admin e-mail address it was bootstrapped with).
func (c *HTTPClient) findUserID(ctx context.Context, orgID, userName string) (string, error) {
	listBody := map[string]any{
		"queries": []map[string]any{
			{"organizationIdQuery": map[string]any{"organizationId": orgID}},
			{"userNameQuery": map[string]any{"userName": userName, "method": "TEXT_QUERY_METHOD_EQUALS"}},
		},
	}
	var list struct {
		Result []struct {
			UserID   string `json:"userId"`
			Username string `json:"username"`
		} `json:"result"`
	}
	if err := c.call(ctx, userService, "ListUsers", listBody, &list, ""); err != nil {
		return "", err
	}
	for _, u := range list.Result {
		if u.Username == userName && u.UserID != "" {
			return u.UserID, nil
		}
	}
	return "", fmt.Errorf("provisioning: no Zitadel user named %q in the organisation", userName)
}
