package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
)

// Zitadel v2 services the installer calls (#915). They are the GA resource
// APIs of the pinned Zitadel 4 and replace the deprecated v1 Management API,
// which Zitadel 5 removes. Every call uses the Connect protocol's JSON form:
// POST /<package>.<Service>/<Method> with a JSON body, which Zitadel serves
// on the same port as the REST gateway.
//
// Three areas still use v1 because Zitadel 4 has no v2 write API for them
// (checked against v4.20.3; reference: docs/en/reference/installer-cli.md):
//   - login policy (registration, external login, linked providers):
//     settings.v2 only reads login settings;
//   - identity provider templates (Google, Apple): idp.v2 only reads them;
//   - SMTP e-mail providers: no v2 service exists yet.
const (
	projectService       = "/zitadel.project.v2.ProjectService/"
	applicationService   = "/zitadel.application.v2.ApplicationService/"
	authorizationService = "/zitadel.authorization.v2.AuthorizationService/"
	userService          = "/zitadel.user.v2.UserService/"

	// userinfoPath is the standard OIDC userinfo endpoint; its sub claim is
	// the id of the user the bearer token belongs to.
	userinfoPath = "/oidc/v1/userinfo"
)

// call performs one v2 Connect RPC and decodes its JSON answer into out (nil
// skips decoding). tolerateSubstr has the same meaning as in request.
func (c *HTTPClient) call(ctx context.Context, service, method string, body, out any, tolerateSubstr string) error {
	path := service + method
	respBody, err := c.request(ctx, http.MethodPost, path, body, tolerateSubstr)
	if err != nil {
		return err
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(respBody, out); err != nil {
		return fmt.Errorf("provisioning: decode %s response: %w", method, err)
	}
	return nil
}

// currentUserOrganization returns the id of the organisation the bearer
// token's user belongs to. The v1 Management API implied it; the v2 APIs
// take it explicitly. Installation users and the provisioning machine user
// live in that organisation.
func (c *HTTPClient) currentUserOrganization(ctx context.Context) (string, error) {
	userID, err := c.CurrentUserID(ctx)
	if err != nil {
		return "", err
	}
	var got struct {
		User struct {
			Details struct {
				ResourceOwner string `json:"resourceOwner"`
			} `json:"details"`
		} `json:"user"`
	}
	if err := c.call(ctx, userService, "GetUserByID", map[string]any{"userId": userID}, &got, ""); err != nil {
		return "", err
	}
	if got.User.Details.ResourceOwner == "" {
		return "", errors.New("provisioning: Zitadel returned no organisation for the current user")
	}
	return got.User.Details.ResourceOwner, nil
}

// zitadelProject is the subset of a v2 project the installer reads.
type zitadelProject struct {
	ID                   string `json:"projectId"`
	Name                 string `json:"name"`
	OrganizationID       string `json:"organizationId"`
	ProjectRoleAssertion bool   `json:"projectRoleAssertion"`
}

// getProject reads one project by id.
func (c *HTTPClient) getProject(ctx context.Context, projectID string) (zitadelProject, error) {
	var got struct {
		Project *zitadelProject `json:"project"`
	}
	if err := c.call(ctx, projectService, "GetProject", map[string]any{"projectId": projectID}, &got, ""); err != nil {
		return zitadelProject{}, err
	}
	if got.Project == nil {
		return zitadelProject{}, fmt.Errorf("provisioning: Zitadel returned no project for id %s", projectID)
	}
	return *got.Project, nil
}
