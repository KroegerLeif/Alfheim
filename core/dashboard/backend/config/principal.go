package config

// PrincipalConfig holds the settings of the alfheim-integrations service
// principal (#958). Plugin actions run only when every field is set;
// otherwise the dashboard starts without them.
type PrincipalConfig struct {
	// PrincipalID is INTEGRATIONS_PRINCIPAL_ID, the machine user's Zitadel id.
	PrincipalID string
	// ClientID and ClientSecret are INTEGRATIONS_CLIENT_ID and
	// INTEGRATIONS_CLIENT_SECRET.
	ClientID     string
	ClientSecret string
	// ProjectID is ZITADEL_PROJECT_ID, the audience of requested tokens.
	ProjectID string
}

// provisionedPlaceholder is what env templates hold before provisioning ran.
const provisionedPlaceholder = "__PROVISIONED__"

// Configured reports whether every service principal setting is present.
// The installer's "__PROVISIONED__" placeholder counts as missing.
func (p PrincipalConfig) Configured() bool {
	for _, v := range []string{p.PrincipalID, p.ClientID, p.ClientSecret, p.ProjectID} {
		if v == "" || v == provisionedPlaceholder {
			return false
		}
	}
	return true
}
