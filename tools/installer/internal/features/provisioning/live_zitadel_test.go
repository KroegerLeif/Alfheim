package provisioning

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

// TestLiveZitadel runs the v2 provisioning calls against a real Zitadel. It is
// skipped unless ALFHEIM_ZITADEL_LIVE_URL (for example http://localhost:8080),
// ALFHEIM_ZITADEL_LIVE_HOST (the instance's external domain) and
// ALFHEIM_ZITADEL_LIVE_PAT_FILE (an IAM owner machine user's PAT) are set;
// ALFHEIM_ZITADEL_LIVE_USER names the user that gets the operator role.
// Used to verify #915 against the pinned Zitadel version; every step runs
// twice to prove idempotence.
func TestLiveZitadel(t *testing.T) {
	baseURL := os.Getenv("ALFHEIM_ZITADEL_LIVE_URL")
	patFile := os.Getenv("ALFHEIM_ZITADEL_LIVE_PAT_FILE")
	if baseURL == "" || patFile == "" {
		t.Skip("ALFHEIM_ZITADEL_LIVE_URL and ALFHEIM_ZITADEL_LIVE_PAT_FILE are not set")
	}
	pat, err := os.ReadFile(patFile)
	if err != nil {
		t.Fatal(err)
	}
	c := &HTTPClient{
		BaseURL: baseURL,
		Host:    os.Getenv("ALFHEIM_ZITADEL_LIVE_HOST"),
		PAT:     strings.TrimSpace(string(pat)),
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	for round := 1; round <= 2; round++ {
		projectID, err := c.EnsureProject(ctx, "Alfheim Live Test")
		if err != nil {
			t.Fatalf("round %d EnsureProject: %v", round, err)
		}
		web, err := c.EnsureOIDCApp(ctx, projectID, AppSpec{
			Name: "Live Web", Type: AppTypePublicPKCE,
			RedirectURIs: []string{"http://localhost/cb"}, DevMode: true,
		})
		if err != nil || web.ClientID == "" {
			t.Fatalf("round %d public app: %+v %v", round, web, err)
		}
		grafana, err := c.EnsureOIDCApp(ctx, projectID, AppSpec{
			Name: "Live Grafana", Type: AppTypeConfidentialWeb,
			RedirectURIs: []string{"http://localhost/grafana/login/generic_oauth"}, DevMode: true,
		})
		if err != nil || grafana.ClientSecret == "" {
			t.Fatalf("round %d confidential app: %+v %v", round, grafana, err)
		}
		if err := c.EnsureRoleAssertion(ctx, projectID); err != nil {
			t.Fatalf("round %d EnsureRoleAssertion: %v", round, err)
		}
		if err := c.EnsureProjectRole(ctx, projectID, OperatorRole); err != nil {
			t.Fatalf("round %d EnsureProjectRole: %v", round, err)
		}
		if user := os.Getenv("ALFHEIM_ZITADEL_LIVE_USER"); user != "" {
			if err := c.GrantProjectRole(ctx, projectID, user, OperatorRoleKey); err != nil {
				t.Fatalf("round %d GrantProjectRole: %v", round, err)
			}
		}
		if err := c.EnsureRegistrationDisabled(ctx); err != nil {
			t.Fatalf("round %d EnsureRegistrationDisabled: %v", round, err)
		}
	}

	userID, err := c.CurrentUserID(ctx)
	if err != nil {
		t.Fatalf("CurrentUserID: %v", err)
	}
	keyID, keyJSON, err := c.AddMachineKey(ctx, userID, time.Now().Add(24*time.Hour))
	if err != nil || len(keyJSON) == 0 {
		t.Fatalf("AddMachineKey: %v", err)
	}
	// Key listings are served from an eventually consistent projection.
	var keys []string
	for attempt := 0; attempt < 20 && !containsID(keys, keyID); attempt++ {
		time.Sleep(250 * time.Millisecond)
		if keys, err = c.ListMachineKeys(ctx, userID); err != nil {
			break
		}
	}
	if err != nil || !containsID(keys, keyID) {
		t.Fatalf("ListMachineKeys = %v, %v; want %s", keys, err, keyID)
	}
	if err := c.RemoveMachineKey(ctx, userID, keyID); err != nil {
		t.Fatalf("RemoveMachineKey: %v", err)
	}
	if _, err := c.ListPersonalAccessTokens(ctx, userID); err != nil {
		t.Fatalf("ListPersonalAccessTokens: %v", err)
	}
}

func containsID(ids []string, id string) bool {
	for _, v := range ids {
		if v == id {
			return true
		}
	}
	return false
}
