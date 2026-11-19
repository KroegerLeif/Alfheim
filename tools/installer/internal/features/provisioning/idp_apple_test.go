package provisioning

import (
	"context"
	"encoding/base64"
	"slices"
	"testing"
)

func appleSpec() IDPSpec {
	return IDPSpec{
		Kind: IDPApple, ClientID: "com.example.signin", TeamID: "ABCDE12345", KeyID: "FGHIJ67890",
		PrivateKey: []byte("pem-key-bytes"),
	}
}

func TestIDPSpec_AppleDetails(t *testing.T) {
	s := appleSpec()
	if s.Name() != "Apple" || s.zitadelType() != "PROVIDER_TYPE_APPLE" || !slices.Equal(s.scopes(), []string{"name", "email"}) {
		t.Errorf("Apple spec details = %q %q %v", s.Name(), s.zitadelType(), s.scopes())
	}
	if got := CallbackURL("https://auth.example.com", IDPApple); got != "https://auth.example.com/ui/login/login/externalidp/callback/form" {
		t.Errorf("CallbackURL() = %q, want Zitadel's form POST endpoint", got)
	}
	rotated := appleSpec()
	rotated.PrivateKey = []byte("other-key")
	if rotated.Fingerprint() == s.Fingerprint() {
		t.Error("a new key must change the fingerprint")
	}
}

func TestHTTPClient_EnsureIDP_AppleLifecycle(t *testing.T) {
	c, srv := newIDPTestClient(t, true)
	ctx := context.Background()

	created, err := c.EnsureIDP(ctx, appleSpec())
	if err != nil || created.Action != IDPCreated {
		t.Fatalf("create: outcome = %+v, err = %v", created, err)
	}
	body := srv.bodies["POST /admin/v1/idps/apple"]
	if body["teamId"] != "ABCDE12345" || body["keyId"] != "FGHIJ67890" || body["clientId"] != "com.example.signin" {
		t.Errorf("create body = %v", body)
	}
	if body["privateKey"] != base64.StdEncoding.EncodeToString([]byte("pem-key-bytes")) {
		t.Errorf("privateKey = %v, want the key as base64 bytes", body["privateKey"])
	}
	if _, leaked := body["clientSecret"]; leaked {
		t.Error("Apple has no client secret field; Zitadel mints it from the key")
	}

	// Second run with the recorded fingerprint: nothing is written.
	same := appleSpec()
	same.ExistingFingerprint = created.Fingerprint
	writes := len(srv.writes)
	if out, err := c.EnsureIDP(ctx, same); err != nil || out.Action != IDPUnchanged || len(srv.writes) != writes {
		t.Fatalf("no-op: outcome = %+v, err = %v, writes = %v", out, err, srv.writes[writes:])
	}

	// A new key with otherwise unchanged settings is uploaded again.
	rekeyed := appleSpec()
	rekeyed.PrivateKey = []byte("new-key")
	rekeyed.ExistingFingerprint = created.Fingerprint
	if out, err := c.EnsureIDP(ctx, rekeyed); err != nil || out.Action != IDPUpdated {
		t.Fatalf("update: outcome = %+v, err = %v", out, err)
	}
	put := srv.bodies["PUT /admin/v1/idps/apple/"+created.ID]
	if put["privateKey"] != base64.StdEncoding.EncodeToString([]byte("new-key")) {
		t.Errorf("update body privateKey = %v", put["privateKey"])
	}

	// A changed Team ID is visible without the fingerprint.
	moved := rekeyed
	moved.TeamID = "ZZZZZ99999"
	moved.ExistingFingerprint = moved.Fingerprint()
	if out, err := c.EnsureIDP(ctx, moved); err != nil || out.Action != IDPUpdated {
		t.Fatalf("team change: outcome = %+v, err = %v", out, err)
	}

	removed, err := c.EnsureIDP(ctx, IDPSpec{Kind: IDPApple})
	if err != nil || removed.Action != IDPRemoved {
		t.Fatalf("remove: outcome = %+v, err = %v", removed, err)
	}
	for _, path := range []string{instanceLoginPolicyIDPsPath, orgLoginPolicyIDPsPath} {
		if slices.Contains(srv.links[path], created.ID) {
			t.Errorf("%s still links the Apple provider", path)
		}
	}
}

func TestHTTPClient_EnsureIDP_GoogleAndAppleAreSeparate(t *testing.T) {
	c, srv := newIDPTestClient(t, false)
	g, err := c.EnsureIDP(context.Background(), googleSpec())
	if err != nil {
		t.Fatal(err)
	}
	a, err := c.EnsureIDP(context.Background(), appleSpec())
	if err != nil {
		t.Fatal(err)
	}
	if g.ID == a.ID || a.Action != IDPCreated {
		t.Errorf("google = %+v, apple = %+v, want two providers", g, a)
	}
	if links := srv.links[instanceLoginPolicyIDPsPath]; !slices.Contains(links, g.ID) || !slices.Contains(links, a.ID) {
		t.Errorf("instance links = %v", links)
	}
}
