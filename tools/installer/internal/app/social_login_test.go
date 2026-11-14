package app

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"alfheim/installer/internal/features/provisioning"
	"alfheim/installer/internal/features/sociallogin"
	"alfheim/installer/internal/shared/envfile"
)

func TestSocialLoginSpecsListsEveryProvider(t *testing.T) {
	specs, err := socialLoginSpecs(map[string]string{
		"ALFHEIM_GOOGLE_CLIENT_ID": "gid", "ALFHEIM_GOOGLE_CLIENT_SECRET": "gsecret",
		"ZITADEL_GOOGLE_IDP_FINGERPRINT": "fp",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(specs) == 0 || specs[0].Kind != provisioning.IDPGoogle || specs[0].ClientSecret != "gsecret" ||
		specs[0].ExistingFingerprint != "fp" {
		t.Errorf("specs = %+v", specs)
	}

	specs, err = socialLoginSpecs(map[string]string{})
	if err != nil || len(specs) == 0 || specs[0].Enabled() {
		t.Errorf("empty .env: specs = %+v, err = %v, want a disabled Google spec", specs, err)
	}

	if _, err := socialLoginSpecs(map[string]string{"ALFHEIM_GOOGLE_CLIENT_ID": "gid"}); err == nil {
		t.Error("a client id without a secret must be rejected")
	}
}

func TestApplySocialLoginOverrides(t *testing.T) {
	existing := map[string]string{"ALFHEIM_GOOGLE_CLIENT_SECRET": "from-env-file"}
	updates, err := applySocialLoginOverrides(existing, sociallogin.Settings{GoogleClientID: "flag-id"})
	if err != nil {
		t.Fatal(err)
	}
	if updates["ALFHEIM_GOOGLE_CLIENT_ID"] != "flag-id" || existing["ALFHEIM_GOOGLE_CLIENT_ID"] != "flag-id" ||
		updates["ALFHEIM_GOOGLE_CLIENT_SECRET"] != "from-env-file" {
		t.Errorf("updates = %v, existing = %v", updates, existing)
	}

	if updates, err := applySocialLoginOverrides(existing, sociallogin.Settings{}); err != nil || updates != nil {
		t.Errorf("no explicit values: updates = %v, err = %v, want nothing", updates, err)
	}
	if _, err := applySocialLoginOverrides(map[string]string{}, sociallogin.Settings{GoogleClientID: "x"}); err == nil {
		t.Error("an id without any secret must be rejected")
	}
}

func TestPrintSocialLogin(t *testing.T) {
	var out bytes.Buffer
	printSocialLogin(&out, []provisioning.IDPOutcome{
		{Kind: provisioning.IDPGoogle, Action: provisioning.IDPCreated, RedirectURI: "https://auth.example.com/cb"},
	})
	got := out.String()
	for _, want := range []string{"google sign-in created", "https://auth.example.com/cb", "create their own household"} {
		if !strings.Contains(got, want) {
			t.Errorf("output %q lacks %q", got, want)
		}
	}

	out.Reset()
	printSocialLogin(&out, []provisioning.IDPOutcome{
		{Kind: provisioning.IDPGoogle, Action: provisioning.IDPRemoved},
		{Kind: provisioning.IDPGoogle, Action: provisioning.IDPAbsent},
	})
	if got := out.String(); !strings.Contains(got, "switched off") || strings.Contains(got, "Note:") {
		t.Errorf("output = %q", got)
	}
}

func TestAuthOrigin(t *testing.T) {
	if authOrigin("auth.example.com", true) != "https://auth.example.com" ||
		authOrigin("auth.example.com", false) != "http://auth.example.com" {
		t.Error("authOrigin must follow the scheme")
	}
}

func TestParseOptionsSocialLoginFlagAndEnvironment(t *testing.T) {
	t.Setenv("ALFHEIM_GOOGLE_CLIENT_ID", "env-id")
	t.Setenv("ALFHEIM_GOOGLE_CLIENT_SECRET", "env-secret")
	var stderr bytes.Buffer
	opts, err := ParseOptions([]string{"--google-client-id", "flag-id"}, &stderr)
	if err != nil {
		t.Fatal(err)
	}
	if opts.SocialLogin.GoogleClientID != "flag-id" || opts.SocialLogin.GoogleClientSecret != "env-secret" {
		t.Errorf("SocialLogin = %+v", opts.SocialLogin)
	}
	if _, err := ParseOptions([]string{"--google-client-secret", "x"}, &stderr); err == nil {
		t.Error("the secret must not be accepted as a flag")
	}
}

// socialWizard answers the external sign-in step.
type socialWizard struct {
	stubWizard
	answer sociallogin.Settings
	asked  bool
}

func (w *socialWizard) AskSocialLogin(s *sociallogin.Settings) error {
	w.asked = true
	*s = w.answer
	return nil
}

func TestInteractiveWizardStoresSocialLoginInEnv(t *testing.T) {
	wiz := &socialWizard{
		stubWizard: interactiveStub(),
		answer:     sociallogin.Settings{GoogleClientID: "gid", GoogleClientSecret: "gsecret"},
	}
	opts := &Options{InstallDir: t.TempDir()}
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), wiz)
	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout)
	}
	if !wiz.asked {
		t.Error("the interactive wizard must offer the external sign-in step")
	}
	vars, err := envfile.ParseFile(filepath.Join(opts.InstallDir, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	if vars["ALFHEIM_GOOGLE_CLIENT_ID"] != "gid" || vars["ALFHEIM_GOOGLE_CLIENT_SECRET"] != "gsecret" {
		t.Errorf("social login vars = %q / %q", vars["ALFHEIM_GOOGLE_CLIENT_ID"], vars["ALFHEIM_GOOGLE_CLIENT_SECRET"])
	}
	if strings.Contains(stdout.String(), "gsecret") {
		t.Error("the secret must never be printed")
	}
}

func TestConfigureSocialLoginRejectsHalfConfiguredProvider(t *testing.T) {
	wiz := &socialWizard{stubWizard: interactiveStub()}
	opts := &Options{InstallDir: t.TempDir(), SocialLogin: sociallogin.Settings{GoogleClientID: "gid"}}
	app, _, stderr := newTestApp(t, opts, healthyDocker(), wiz)
	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want failure", code)
	}
	if wiz.asked {
		t.Error("the wizard must not ask when a flag already answered")
	}
	if !strings.Contains(stderr.String(), "ALFHEIM_GOOGLE_CLIENT_SECRET") {
		t.Errorf("stderr = %q", stderr.String())
	}
}

func TestRunProvision_RejectsGoogleIDWithoutSecret(t *testing.T) {
	dir := t.TempDir()
	envPath := writeProvisionEnv(t, dir, "false")
	patPath := filepath.Join(dir, "pat.txt")
	if err := os.WriteFile(patPath, []byte("test-pat\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("ALFHEIM_GOOGLE_CLIENT_SECRET", "")
	var stdout, stderr bytes.Buffer
	code := RunProvision([]string{
		"--env-file", envPath, "--pat-file", patPath, "--google-client-id", "gid",
		"--zitadel-url", "http://127.0.0.1:1",
	}, &stdout, &stderr)
	if code != ExitFailure || !strings.Contains(stderr.String(), "ALFHEIM_GOOGLE_CLIENT_SECRET") {
		t.Fatalf("RunProvision() = %d, stderr = %q", code, stderr.String())
	}
}
