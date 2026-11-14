package app

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"alfheim/installer/internal/features/provisioning"
	"alfheim/installer/internal/features/security"
	"alfheim/installer/internal/features/sociallogin"
	"alfheim/installer/internal/shared/envfile"
)

func TestSocialLoginSpecsListsEveryProvider(t *testing.T) {
	specs, err := socialLoginSpecs(map[string]string{
		"ALFHEIM_GOOGLE_CLIENT_ID": "gid", "ALFHEIM_GOOGLE_CLIENT_SECRET": "gsecret",
		"ZITADEL_GOOGLE_IDP_FINGERPRINT": "fp",
	}, failingKeyReader(t))
	if err != nil {
		t.Fatal(err)
	}
	if len(specs) == 0 || specs[0].Kind != provisioning.IDPGoogle || specs[0].ClientSecret != "gsecret" ||
		specs[0].ExistingFingerprint != "fp" {
		t.Errorf("specs = %+v", specs)
	}

	specs, err = socialLoginSpecs(map[string]string{}, failingKeyReader(t))
	if err != nil || len(specs) == 0 || specs[0].Enabled() {
		t.Errorf("empty .env: specs = %+v, err = %v, want a disabled Google spec", specs, err)
	}

	if _, err := socialLoginSpecs(map[string]string{"ALFHEIM_GOOGLE_CLIENT_ID": "gid"}, failingKeyReader(t)); err == nil {
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

// failingKeyReader fails the test if the Apple key is read although Apple
// is not configured.
func failingKeyReader(t *testing.T) KeyReader {
	return func(path string) ([]byte, error) {
		t.Errorf("unexpected key read of %s", path)
		return nil, os.ErrNotExist
	}
}

// writeAppleKey writes a real P-256 PKCS #8 key with mode and returns its path.
func writeAppleKey(t *testing.T, mode os.FileMode) string {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "AuthKey_FGHIJ67890.p8")
	if err := os.WriteFile(path, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}), mode); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, mode); err != nil {
		t.Fatal(err)
	}
	return path
}

func appleEnv(keyFile string) map[string]string {
	return map[string]string{
		"ALFHEIM_APPLE_CLIENT_ID": "com.example.signin", "ALFHEIM_APPLE_TEAM_ID": "ABCDE12345",
		"ALFHEIM_APPLE_KEY_ID": "FGHIJ67890", "ALFHEIM_APPLE_PRIVATE_KEY_FILE": keyFile,
		"ZITADEL_APPLE_IDP_FINGERPRINT": "apple-fp",
	}
}

func TestSocialLoginSpecsReadsTheAppleKeyFile(t *testing.T) {
	path := writeAppleKey(t, 0o600)
	specs, err := socialLoginSpecs(appleEnv(path), security.ReadPrivateKeyFile)
	if err != nil {
		t.Fatal(err)
	}
	apple := specs[1]
	if apple.Kind != provisioning.IDPApple || apple.TeamID != "ABCDE12345" || apple.ExistingFingerprint != "apple-fp" ||
		!bytes.Contains(apple.PrivateKey, []byte("PRIVATE KEY")) {
		t.Errorf("apple spec = %+v", apple)
	}
}

func TestSocialLoginSpecsRefusesALooseAppleKeyFile(t *testing.T) {
	path := writeAppleKey(t, 0o644)
	_, err := socialLoginSpecs(appleEnv(path), security.ReadPrivateKeyFile)
	if err == nil || !strings.Contains(err.Error(), "chmod 600") || !strings.Contains(err.Error(), "Apple") {
		t.Fatalf("error = %v, want the loose key file refused", err)
	}
}

func TestConfigureSocialLoginRefusesALooseAppleKeyBeforeBoot(t *testing.T) {
	path := writeAppleKey(t, 0o640)
	opts := &Options{InstallDir: t.TempDir(), NonInteractive: true, Domain: "example.com", TLSStrategy: "internal",
		AdminEmail: "ops@example.com", SocialLogin: sociallogin.FromEnv(appleEnv(path))}
	app, _, stderr := newTestApp(t, opts, healthyDocker(), nil)
	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want failure", code)
	}
	if !strings.Contains(stderr.String(), "chmod 600") {
		t.Errorf("stderr = %q", stderr.String())
	}
	if _, err := os.Stat(filepath.Join(opts.InstallDir, ".env")); !os.IsNotExist(err) {
		t.Error("nothing may be rendered before the key file is fixed")
	}
}

func TestConfigureSocialLoginStoresOnlyTheAppleKeyPath(t *testing.T) {
	path := writeAppleKey(t, 0o600)
	opts := &Options{InstallDir: t.TempDir(), NonInteractive: true, Domain: "example.com", TLSStrategy: "internal",
		AdminEmail: "ops@example.com", SocialLogin: sociallogin.FromEnv(appleEnv(path))}
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), nil)
	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout)
	}
	raw, err := os.ReadFile(filepath.Join(opts.InstallDir, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "ALFHEIM_APPLE_PRIVATE_KEY_FILE="+path) {
		t.Error("the key path must be stored in .env")
	}
	if strings.Contains(string(raw), "PRIVATE KEY") || strings.Contains(stdout.String(), "PRIVATE KEY") {
		t.Error("the key itself must never reach .env or the output")
	}
}
