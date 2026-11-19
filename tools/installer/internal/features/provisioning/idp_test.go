package provisioning

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func googleSpec() IDPSpec {
	return IDPSpec{Kind: IDPGoogle, ClientID: "google-id", ClientSecret: "google-secret"}
}

func TestIDPSpec_Fingerprint(t *testing.T) {
	a := googleSpec()
	if a.Fingerprint() == "" || a.Fingerprint() != googleSpec().Fingerprint() {
		t.Fatal("fingerprint must be stable and non-empty for an enabled spec")
	}
	rotated := googleSpec()
	rotated.ClientSecret = "other"
	if rotated.Fingerprint() == a.Fingerprint() {
		t.Error("a rotated secret must change the fingerprint")
	}
	if strings.Contains(a.Fingerprint(), "google-secret") {
		t.Error("the fingerprint must not contain the secret")
	}
	if (IDPSpec{Kind: IDPGoogle}).Fingerprint() != "" {
		t.Error("a disabled spec has no fingerprint")
	}
}

func TestCallbackURL(t *testing.T) {
	got := CallbackURL("https://auth.example.com/", IDPGoogle)
	if got != "https://auth.example.com/ui/login/login/externalidp/callback" {
		t.Errorf("CallbackURL() = %q", got)
	}
}

func TestFingerprintEnvKey(t *testing.T) {
	if got := FingerprintEnvKey(IDPGoogle); got != "ZITADEL_GOOGLE_IDP_FINGERPRINT" {
		t.Errorf("FingerprintEnvKey() = %q", got)
	}
}

func TestProvision_ReconcilesIDPsAndRecordsFingerprints(t *testing.T) {
	c := newFakeClient()
	in := testInput()
	in.AuthOrigin = "https://auth.example.com"
	in.IDPs = []IDPSpec{googleSpec()}
	res, err := Provision(context.Background(), c, in, nil)
	if err != nil {
		t.Fatalf("Provision() error = %v", err)
	}
	if len(res.IDPs) != 1 || res.IDPs[0].Action != IDPCreated || res.IDPs[0].Kind != IDPGoogle {
		t.Fatalf("IDPs = %+v, want one created Google provider", res.IDPs)
	}
	if res.IDPs[0].RedirectURI != "https://auth.example.com/ui/login/login/externalidp/callback" {
		t.Errorf("RedirectURI = %q", res.IDPs[0].RedirectURI)
	}
	if got := res.EnvUpdates()["ZITADEL_GOOGLE_IDP_FINGERPRINT"]; got != googleSpec().Fingerprint() {
		t.Errorf("fingerprint env update = %q", got)
	}
}

func TestProvision_DisabledIDPHasNoRedirectAndClearsFingerprint(t *testing.T) {
	c := newFakeClient()
	in := testInput()
	in.IDPs = []IDPSpec{{Kind: IDPGoogle, ExistingFingerprint: "previous"}}
	res, err := Provision(context.Background(), c, in, nil)
	if err != nil {
		t.Fatalf("Provision() error = %v", err)
	}
	if res.IDPs[0].RedirectURI != "" {
		t.Errorf("RedirectURI = %q, want empty for a disabled provider", res.IDPs[0].RedirectURI)
	}
	if v, ok := res.EnvUpdates()["ZITADEL_GOOGLE_IDP_FINGERPRINT"]; !ok || v != "" {
		t.Errorf("fingerprint = %q (present %t), want it cleared", v, ok)
	}
}

func TestProvision_IDPFailureIsFatalOnFreshInstallAndAWarningOnUpdate(t *testing.T) {
	in := testInput()
	in.IDPs = []IDPSpec{googleSpec()}

	c := newFakeClient()
	c.idpErr = errors.New("forbidden")
	if _, err := Provision(context.Background(), c, in, nil); err == nil || !strings.Contains(err.Error(), "Google sign-in") {
		t.Fatalf("fresh install: error = %v, want the Google sign-in failure", err)
	}

	c = newFakeClient()
	c.idpErr = errors.New("forbidden")
	res, err := Provision(context.Background(), c, in, map[string]string{"ALFHEIM_WEB_CLIENT_ID": "web"})
	if err != nil {
		t.Fatalf("existing install: error = %v, want a warning", err)
	}
	if len(res.Warnings) != 1 || !strings.Contains(res.Warnings[0], "social login") || res.IDPs != nil {
		t.Errorf("Warnings = %v, IDPs = %v", res.Warnings, res.IDPs)
	}
	if _, ok := res.EnvUpdates()["ZITADEL_GOOGLE_IDP_FINGERPRINT"]; ok {
		t.Error("a failed reconciliation must not touch the recorded fingerprint")
	}
}

func TestProvision_SkipsNeverProvisionedDisabledIDP(t *testing.T) {
	c := newFakeClient()
	in := testInput()
	in.IDPs = []IDPSpec{{Kind: IDPGoogle}}
	res, err := Provision(context.Background(), c, in, nil)
	if err != nil {
		t.Fatalf("Provision() error = %v", err)
	}
	if len(res.IDPs) != 0 || strings.Contains(strings.Join(c.calls, "|"), "EnsureIDP") {
		t.Errorf("IDPs = %v, calls = %v, want no provider call", res.IDPs, c.calls)
	}
	if _, ok := res.EnvUpdates()["ZITADEL_GOOGLE_IDP_FINGERPRINT"]; ok {
		t.Error("an untouched provider must not add a fingerprint to .env")
	}
}
