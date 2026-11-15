package signup

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"alfheim/go-shared/auth"
)

func TestParseAllowlist(t *testing.T) {
	list, err := ParseAllowlist(" Alice@Example.com, @family.example , trusted.org ,, ")
	if err != nil {
		t.Fatal(err)
	}
	if !list.Enabled() {
		t.Fatal("a non-empty list must be enabled")
	}
	for email, want := range map[string]bool{
		"alice@example.com":  true,
		"ALICE@EXAMPLE.COM":  true,
		"bob@example.com":    false,
		"kid@family.example": true,
		"x@trusted.org":      true,
		"x@sub.trusted.org":  false,
		"x@evil-trusted.org": false,
		"":                   false,
		"no-at-sign":         false,
	} {
		if got := list.Allows(email); got != want {
			t.Errorf("Allows(%q) = %v, want %v", email, got, want)
		}
	}

	empty, err := ParseAllowlist("  ")
	if err != nil || empty.Enabled() {
		t.Errorf("an empty value must disable the allowlist: %+v %v", empty, err)
	}
	var zero Allowlist
	if zero.Enabled() || zero.Allows("a@b.c") {
		t.Error("the zero Allowlist must be disabled and admit nobody by itself")
	}
}

func TestParseAllowlistFailsClosed(t *testing.T) {
	for _, bad := range []string{
		"*", "@", "localhost", "@-bad.example", "a@", "a@@example.com", "Alice <alice@example.com>",
		"alice@localhost", "ex ample.com", "good.example,*", "@" + strings.Repeat("a", 64) + ".com",
	} {
		if _, err := ParseAllowlist(bad); err == nil {
			t.Errorf("ParseAllowlist(%q) succeeded, want an error", bad)
		}
	}
}

type fakeIdentity struct {
	id  Identity
	err error
}

func (f fakeIdentity) Identity(context.Context, string) (Identity, error) { return f.id, f.err }

func TestPolicy(t *testing.T) {
	list, _ := ParseAllowlist("@family.example")
	claims := &auth.UserClaims{Subject: "u1", AccessToken: "tok"}
	ctx := context.Background()

	cases := []struct {
		name   string
		policy Policy
		claims *auth.UserClaims
		ok     bool
	}{
		{"disabled allowlist admits everyone", Policy{}, claims, true},
		{"listed and verified", Policy{List: list, Identity: fakeIdentity{id: Identity{"a@family.example", true}}}, claims, true},
		{"listed but unverified", Policy{List: list, Identity: fakeIdentity{id: Identity{"a@family.example", false}}}, claims, false},
		{"verified but unlisted", Policy{List: list, Identity: fakeIdentity{id: Identity{"a@other.example", true}}}, claims, false},
		{"lookup failure", Policy{List: list, Identity: fakeIdentity{err: errors.New("down")}}, claims, false},
		{"no token", Policy{List: list, Identity: fakeIdentity{id: Identity{"a@family.example", true}}}, &auth.UserClaims{Subject: "u1"}, false},
		{"no identity source", Policy{List: list}, claims, false},
	}
	for _, tc := range cases {
		err := tc.policy.AllowHouseholdCreation(ctx, tc.claims)
		if tc.ok != (err == nil) {
			t.Errorf("%s: err = %v", tc.name, err)
		}
	}
}

// fakeIssuer serves discovery and userinfo; userinfo answers with body for
// the bearer "good" and 401 otherwise.
func fakeIssuer(t *testing.T, body string) (*httptest.Server, *int) {
	t.Helper()
	discoveries := 0
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			discoveries++
			_, _ = w.Write([]byte(`{"userinfo_endpoint":"` + srv.URL + `/oidc/v1/userinfo"}`))
		case "/oidc/v1/userinfo":
			if r.Header.Get("Authorization") != "Bearer good" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_, _ = w.Write([]byte(body))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv, &discoveries
}

func TestUserInfoSource(t *testing.T) {
	ctx := context.Background()
	srv, discoveries := fakeIssuer(t, `{"email":"a@family.example","email_verified":true}`)
	src := &UserInfoSource{IssuerURL: srv.URL + "/"}
	for i := 0; i < 2; i++ {
		id, err := src.Identity(ctx, "good")
		if err != nil || id.Email != "a@family.example" || !id.EmailVerified {
			t.Fatalf("Identity() = %+v, %v", id, err)
		}
	}
	if *discoveries != 1 {
		t.Errorf("discovery fetched %d times, want once (cached)", *discoveries)
	}
	if _, err := src.Identity(ctx, "bad"); err == nil {
		t.Error("a rejected token must be an error")
	}

	// email_verified as a string, as some providers send it.
	srv2, _ := fakeIssuer(t, `{"email":"a@x.example","email_verified":"TRUE"}`)
	if id, err := (&UserInfoSource{IssuerURL: srv2.URL}).Identity(ctx, "good"); err != nil || !id.EmailVerified {
		t.Errorf("string email_verified: %+v %v", id, err)
	}
	srv3, _ := fakeIssuer(t, `{"email":"a@x.example","email_verified":1}`)
	if id, _ := (&UserInfoSource{IssuerURL: srv3.URL}).Identity(ctx, "good"); id.EmailVerified {
		t.Error("an unexpected email_verified type must count as unverified")
	}
	srv4, _ := fakeIssuer(t, `not json`)
	if _, err := (&UserInfoSource{IssuerURL: srv4.URL}).Identity(ctx, "good"); err == nil {
		t.Error("a malformed userinfo answer must be an error")
	}
}

func TestUserInfoSourceDiscoveryFailures(t *testing.T) {
	ctx := context.Background()
	noEndpoint := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{}`))
	}))
	defer noEndpoint.Close()
	if _, err := (&UserInfoSource{IssuerURL: noEndpoint.URL}).Identity(ctx, "t"); err == nil {
		t.Error("a discovery document without userinfo_endpoint must be an error")
	}
	if _, err := (&UserInfoSource{IssuerURL: "http://127.0.0.1:1"}).Identity(ctx, "t"); err == nil {
		t.Error("an unreachable issuer must be an error")
	}
	if _, err := (&UserInfoSource{IssuerURL: "http://bad host"}).Identity(ctx, "t"); err == nil {
		t.Error("an invalid issuer URL must be an error")
	}
}
