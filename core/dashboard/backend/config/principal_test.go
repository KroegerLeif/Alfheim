package config

import "testing"

func TestLoad_IntegrationsPrincipalAndChores(t *testing.T) {
	t.Setenv("INTEGRATIONS_CHORES_URL", "")
	t.Setenv("INTEGRATIONS_PRINCIPAL_ID", " p-1 ")
	t.Setenv("INTEGRATIONS_CLIENT_ID", "alfheim-integrations")
	t.Setenv("INTEGRATIONS_CLIENT_SECRET", "s3cret")
	t.Setenv("ZITADEL_PROJECT_ID", "proj")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	ic := cfg.Integrations
	if ic.ChoresURL != "http://chores-backend:8000" || ic.Principal.PrincipalID != "p-1" || !ic.Principal.Configured() {
		t.Fatalf("integrations: %+v", ic)
	}
	t.Setenv("INTEGRATIONS_CHORES_URL", "http://chores.internal:9000/")
	t.Setenv("ZITADEL_PROJECT_ID", "__PROVISIONED__")
	cfg, err = Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Integrations.ChoresURL != "http://chores.internal:9000" || cfg.Integrations.Principal.Configured() {
		t.Fatalf("a placeholder is not configured: %+v", cfg.Integrations)
	}
	if (PrincipalConfig{}).Configured() {
		t.Fatal("an empty principal is not configured")
	}
}
