package provisioning

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
)

// IntegrationsUserName is the Zitadel machine user the dashboard
// authenticates as, with client credentials, when a plugin acts on another
// app for a household (#958, ADR 0010 section 6). core/household binds it to
// households as a service principal.
const IntegrationsUserName = "alfheim-integrations"

// MachineUserSpec declares a machine user with client credentials.
type MachineUserSpec struct {
	// UserName is the login name and the key used to look the user up; it is
	// also the client id of its client credentials.
	UserName    string
	Name        string
	Description string
	// ExistingClientID/-Secret are the credentials on file from a previous
	// run, reused while the user still exists so a re-run never rotates them.
	ExistingClientID     string
	ExistingClientSecret string
}

// MachineCredentials is what Zitadel holds for a reconciled machine user.
// UserID is the subject of its tokens.
type MachineCredentials struct {
	UserID       string
	ClientID     string
	ClientSecret string
}

// machineAccessTokenTypeJWT makes Zitadel issue JWT access tokens for the
// user's client credentials, which the backends validate against the JWKS.
const machineAccessTokenTypeJWT = "ACCESS_TOKEN_TYPE_JWT"

// EnsureMachineUser implements Client.
//
// The user is looked up by user name in the provisioning user's organisation
// and created there when missing. Its access token type is set to JWT through
// the v1 Management API, since the user.v2 service of Zitadel 4 cannot set
// it. A client secret is generated only when none is on file for this user.
func (c *HTTPClient) EnsureMachineUser(ctx context.Context, spec MachineUserSpec) (MachineCredentials, error) {
	if spec.UserName == "" {
		return MachineCredentials{}, errors.New("provisioning: machine user name must not be empty")
	}
	orgID, err := c.currentUserOrganization(ctx)
	if err != nil {
		return MachineCredentials{}, err
	}
	userID, err := c.lookupUserID(ctx, orgID, spec.UserName)
	if err != nil {
		return MachineCredentials{}, err
	}
	created := userID == ""
	if created {
		if userID, err = c.createMachineUser(ctx, orgID, spec); err != nil {
			return MachineCredentials{}, err
		}
	}

	machineBody := map[string]any{
		"name":            spec.Name,
		"description":     spec.Description,
		"accessTokenType": machineAccessTokenTypeJWT,
	}
	path := "/management/v1/users/" + url.PathEscape(userID) + "/machine"
	if _, err := c.request(ctx, http.MethodPut, path, machineBody, zitadelNoChangesMessage); err != nil {
		return MachineCredentials{}, err
	}

	if !created && spec.ExistingClientID == spec.UserName && spec.ExistingClientSecret != "" {
		return MachineCredentials{UserID: userID, ClientID: spec.UserName, ClientSecret: spec.ExistingClientSecret}, nil
	}
	var secret struct {
		ClientSecret string `json:"clientSecret"`
	}
	if err := c.call(ctx, userService, "AddSecret", map[string]any{"userId": userID}, &secret, ""); err != nil {
		return MachineCredentials{}, err
	}
	if secret.ClientSecret == "" {
		return MachineCredentials{}, fmt.Errorf("provisioning: zitadel returned no client secret for %q", spec.UserName)
	}
	return MachineCredentials{UserID: userID, ClientID: spec.UserName, ClientSecret: secret.ClientSecret}, nil
}

// createMachineUser creates the machine user in orgID and returns its id.
func (c *HTTPClient) createMachineUser(ctx context.Context, orgID string, spec MachineUserSpec) (string, error) {
	body := map[string]any{
		"organizationId": orgID,
		"username":       spec.UserName,
		"machine":        map[string]any{"name": spec.Name, "description": spec.Description},
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := c.call(ctx, userService, "CreateUser", body, &created, ""); err != nil {
		return "", err
	}
	if created.ID == "" {
		return "", fmt.Errorf("provisioning: zitadel returned no id creating %q", spec.UserName)
	}
	return created.ID, nil
}
