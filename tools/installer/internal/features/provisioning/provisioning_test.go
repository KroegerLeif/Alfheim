package provisioning

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
)

// fakeClient is an in-memory Client double used to test Provision's
// reconciliation logic without any network involved.
type fakeClient struct {
	projects map[string]string // name -> id
	apps     map[string]Credentials
	calls    []string
	failNext error
	// registrationDisabled counts EnsureRegistrationDisabled calls.
	registrationDisabled int
	registrationErr      error
	// operatorErr fails EnsureRoleAssertion, the first operator-access step.
	operatorErr error
}

func newFakeClient() *fakeClient {
	return &fakeClient{projects: map[string]string{}, apps: map[string]Credentials{}}
}

func (f *fakeClient) EnsureProject(_ context.Context, name string) (string, error) {
	f.calls = append(f.calls, "EnsureProject:"+name)
	if f.failNext != nil {
		err := f.failNext
		f.failNext = nil
		return "", err
	}
	if id, ok := f.projects[name]; ok {
		return id, nil
	}
	id := "project-" + name
	f.projects[name] = id
	return id, nil
}

func (f *fakeClient) EnsureOIDCApp(_ context.Context, projectID string, spec AppSpec) (Credentials, error) {
	f.calls = append(f.calls, "EnsureOIDCApp:"+projectID+":"+spec.Name)
	if f.failNext != nil {
		err := f.failNext
		f.failNext = nil
		return Credentials{}, err
	}
	if creds, ok := f.apps[spec.Name]; ok {
		return creds, nil
	}
	creds := Credentials{ClientID: "client-" + spec.Name}
	if spec.Type == AppTypeConfidentialWeb {
		creds.ClientSecret = "secret-" + spec.Name
	}
	f.apps[spec.Name] = creds
	return creds, nil
}

func (f *fakeClient) EnsureRegistrationDisabled(_ context.Context) error {
	f.calls = append(f.calls, "EnsureRegistrationDisabled")
	f.registrationDisabled++
	return f.registrationErr
}

func (f *fakeClient) EnsureRoleAssertion(_ context.Context, projectID string) error {
	f.calls = append(f.calls, "EnsureRoleAssertion:"+projectID)
	return f.operatorErr
}

func (f *fakeClient) EnsureProjectRole(_ context.Context, projectID string, role RoleSpec) error {
	f.calls = append(f.calls, "EnsureProjectRole:"+projectID+":"+role.Key)
	return nil
}

func (f *fakeClient) GrantProjectRole(_ context.Context, projectID, userName, roleKey string) error {
	f.calls = append(f.calls, "GrantProjectRole:"+projectID+":"+userName+":"+roleKey)
	return nil
}

func TestProvision_ReconcilesOperatorAccess(t *testing.T) {
	c := newFakeClient()
	in := testInput()
	in.OperatorUserName = "ops@example.com"
	if _, err := Provision(context.Background(), c, in, nil); err != nil {
		t.Fatalf("Provision() error = %v", err)
	}
	want := []string{
		"EnsureRoleAssertion:project-Alfheim",
		"EnsureProjectRole:project-Alfheim:alfheim_operator",
		"GrantProjectRole:project-Alfheim:ops@example.com:alfheim_operator",
	}
	got := strings.Join(c.calls, "|")
	for _, w := range want {
		if !strings.Contains(got, w) {
			t.Errorf("missing call %q in %v", w, c.calls)
		}
	}
}

func TestProvision_OperatorAccessFailureIsFatalOnFreshInstallWarningOnExisting(t *testing.T) {
	c := newFakeClient()
	c.operatorErr = errors.New("forbidden")
	if _, err := Provision(context.Background(), c, testInput(), nil); err == nil {
		t.Error("fresh install: want an error")
	}

	c = newFakeClient()
	c.operatorErr = errors.New("forbidden")
	res, err := Provision(context.Background(), c, testInput(), map[string]string{"ALFHEIM_WEB_CLIENT_ID": "client-1"})
	if err != nil {
		t.Fatalf("existing install: error = %v, want a warning only", err)
	}
	if len(res.Warnings) != 1 || !strings.Contains(res.Warnings[0], "alfheim_operator") {
		t.Errorf("warnings = %v", res.Warnings)
	}
}

func TestProvision_DisablesRegistrationOnEveryRun(t *testing.T) {
	c := newFakeClient()
	for i := 0; i < 2; i++ {
		if _, err := Provision(context.Background(), c, testInput(), nil); err != nil {
			t.Fatalf("Provision() run %d error = %v", i, err)
		}
	}
	if c.registrationDisabled != 2 {
		t.Errorf("EnsureRegistrationDisabled calls = %d, want one per Provision run", c.registrationDisabled)
	}
}

func TestProvision_FreshInstallFailsWhenRegistrationCannotBeDisabled(t *testing.T) {
	c := newFakeClient()
	c.registrationErr = errors.New("forbidden")
	if _, err := Provision(context.Background(), c, testInput(), map[string]string{"ALFHEIM_WEB_CLIENT_ID": "__PROVISIONED__"}); err == nil {
		t.Fatal("Provision() must fail a fresh install when self-registration stays enabled")
	}
}

func TestProvision_ExistingInstallWarnsInsteadOfFailing(t *testing.T) {
	c := newFakeClient()
	c.registrationErr = errors.New("forbidden")
	res, err := Provision(context.Background(), c, testInput(), map[string]string{"ALFHEIM_WEB_CLIENT_ID": "existing-client"})
	if err != nil {
		t.Fatalf("Provision() must not fail an existing install: %v", err)
	}
	if res.ProjectID == "" || len(res.Warnings) != 1 {
		t.Fatalf("Result = %+v, want provisioned ids and exactly one warning", res)
	}
	for _, want := range []string{"may still be ENABLED", "forbidden", "Default settings", "User registration allowed"} {
		if !strings.Contains(res.Warnings[0], want) {
			t.Errorf("warning %q does not contain %q", res.Warnings[0], want)
		}
	}
}

func testInput() Input {
	return BuildInput("Alfheim", "https://alfheim.example.com", false, AppSlugs)
}

func TestProvision_CreatesProjectAndApps(t *testing.T) {
	c := newFakeClient()
	result, err := Provision(context.Background(), c, testInput(), nil)
	if err != nil {
		t.Fatalf("Provision() error = %v", err)
	}
	if result.ProjectID != "project-Alfheim" {
		t.Errorf("ProjectID = %q", result.ProjectID)
	}
	if result.WebClientID != "client-Alfheim Web" {
		t.Errorf("WebClientID = %q", result.WebClientID)
	}
	if result.GrafanaClientID != "client-Grafana" || result.GrafanaSecret != "secret-Grafana" {
		t.Errorf("Grafana credentials = %+v", result)
	}
}

func TestProvision_IsIdempotent(t *testing.T) {
	c := newFakeClient()
	first, err := Provision(context.Background(), c, testInput(), nil)
	if err != nil {
		t.Fatal(err)
	}
	second, err := Provision(context.Background(), c, testInput(), map[string]string{
		"ALFHEIM_WEB_CLIENT_ID":      first.WebClientID,
		"GRAFANA_OIDC_CLIENT_ID":     first.GrafanaClientID,
		"GRAFANA_OIDC_CLIENT_SECRET": first.GrafanaSecret,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(first, second) {
		t.Errorf("Provision() changed on a second run: %+v vs %+v", first, second)
	}
}

func TestProvision_RejectsNilClient(t *testing.T) {
	if _, err := Provision(context.Background(), nil, testInput(), nil); err == nil {
		t.Fatal("Provision() error = nil, want a failure for a nil client")
	}
}

func TestProvision_RejectsEmptyProjectName(t *testing.T) {
	in := testInput()
	in.ProjectName = ""
	if _, err := Provision(context.Background(), newFakeClient(), in, nil); err == nil {
		t.Fatal("Provision() error = nil, want a failure for an empty project name")
	}
}

func TestProvision_PropagatesProjectError(t *testing.T) {
	c := newFakeClient()
	sentinel := errors.New("boom")
	c.failNext = sentinel
	if _, err := Provision(context.Background(), c, testInput(), nil); !errors.Is(err, sentinel) {
		t.Fatalf("Provision() error = %v, want %v", err, sentinel)
	}
}

func TestProvision_PropagatesAppError(t *testing.T) {
	c := newFakeClient()
	// Let the project succeed, then fail the first app call.
	if _, err := c.EnsureProject(context.Background(), "Alfheim"); err != nil {
		t.Fatal(err)
	}
	sentinel := errors.New("boom")
	c.failNext = sentinel
	if _, err := Provision(context.Background(), c, testInput(), nil); !errors.Is(err, sentinel) {
		t.Fatalf("Provision() error = %v, want %v", err, sentinel)
	}
}

func TestAppSlugsIncludeHousehold(t *testing.T) {
	// The Tier-1 household frontend (basePath /household) shares the web
	// client, so both fresh installs and Day-2 re-provisioning must register
	// its redirect and post-logout URIs.
	in := BuildInput("Alfheim", "https://alfheim.example.com", false, AppSlugs)
	const want = "https://alfheim.example.com/household/"
	for name, uris := range map[string][]string{
		"redirect":    in.WebApp.RedirectURIs,
		"post-logout": in.WebApp.PostLogoutRedirectURIs,
	} {
		found := false
		for _, u := range uris {
			found = found || u == want
		}
		if !found {
			t.Errorf("%s URIs = %v, want %s", name, uris, want)
		}
	}
}

func TestBuildInput_RedirectURIs(t *testing.T) {
	in := BuildInput("Alfheim", "https://alfheim.example.com", true, []string{"pantry", "chat"})
	want := []string{
		"https://alfheim.example.com/",
		"https://alfheim.example.com/pantry/",
		"https://alfheim.example.com/chat/",
	}
	if len(in.WebApp.RedirectURIs) != len(want) {
		t.Fatalf("RedirectURIs = %v, want %v", in.WebApp.RedirectURIs, want)
	}
	for i, w := range want {
		if in.WebApp.RedirectURIs[i] != w {
			t.Errorf("RedirectURIs[%d] = %q, want %q", i, in.WebApp.RedirectURIs[i], w)
		}
	}
	if !in.WebApp.DevMode {
		t.Error("DevMode must be true when the installation is not served over TLS")
	}
	if in.GrafanaApp.RedirectURIs[0] != "https://alfheim.example.com/grafana/login/generic_oauth" {
		t.Errorf("Grafana redirect = %q", in.GrafanaApp.RedirectURIs[0])
	}
	if in.GrafanaApp.PostLogoutRedirectURIs[0] != "https://alfheim.example.com/grafana/login" {
		t.Errorf("Grafana post-logout redirect = %q", in.GrafanaApp.PostLogoutRedirectURIs[0])
	}
}
