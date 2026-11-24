package provisioning

import (
	"context"
	"fmt"
)

// .env keys of the integrations machine user (#958). The dashboard reads the
// client credentials; core/household reads the principal id as
// ALFHEIM_SERVICE_PRINCIPAL_IDS.
const (
	IntegrationsPrincipalEnvKey    = "INTEGRATIONS_PRINCIPAL_ID"
	IntegrationsClientIDEnvKey     = "INTEGRATIONS_CLIENT_ID"
	IntegrationsClientSecretEnvKey = "INTEGRATIONS_CLIENT_SECRET"
)

// ensureIntegrationsUser reconciles the integrations machine user, reusing
// the credentials existing (a parsed .env) holds. A zero spec is skipped.
func ensureIntegrationsUser(
	ctx context.Context, c Client, spec MachineUserSpec, existing map[string]string,
) (MachineCredentials, error) {
	if spec.UserName == "" {
		return MachineCredentials{}, nil
	}
	spec.ExistingClientID = existing[IntegrationsClientIDEnvKey]
	spec.ExistingClientSecret = existing[IntegrationsClientSecretEnvKey]
	if spec.ExistingClientSecret == "__PROVISIONED__" {
		spec.ExistingClientSecret = ""
	}
	creds, err := c.EnsureMachineUser(ctx, spec)
	if err != nil {
		return MachineCredentials{}, fmt.Errorf("ensure machine user %q: %w", spec.UserName, err)
	}
	return creds, nil
}

// IntegrationsWarning is the operator-facing message for an integrations
// machine user that could not be reconciled on an existing installation.
func IntegrationsWarning(cause error) string {
	return fmt.Sprintf("WARNING: the Zitadel machine user %q could not be set up: %v\n"+
		"  Plugins cannot trigger actions in other apps (for example create chores) until it exists.\n"+
		"  Re-run alfheim-setup update (or provision) with a PAT that has IAM_OWNER rights to retry.",
		IntegrationsUserName, cause)
}
