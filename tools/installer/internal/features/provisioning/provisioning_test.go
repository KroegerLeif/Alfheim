package provisioning

import (
	"context"
	"errors"
	"testing"
)

// fakeClient is an in-memory Client double used to test Provision's
// reconciliation logic without any network involved.
type fakeClient struct {
	projects map[string]string // name -> id
	apps     map[string]Credentials
	calls    []string
	failNext error
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
	if first != second {
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
