package attachmenturl

import (
	"errors"
	"net/url"
	"strings"
	"testing"
	"time"
)

var testSecret = []byte("0123456789abcdef0123456789abcdef")

func newTestSigner(t *testing.T, now *time.Time) *Signer {
	t.Helper()
	s, err := NewSigner(testSecret, 15*time.Minute, "https://alfheim.example/")
	if err != nil {
		t.Fatal(err)
	}
	s.now = func() time.Time { return *now }
	return s
}

func TestNewSignerRejectsWeakConfig(t *testing.T) {
	if _, err := NewSigner([]byte("too-short"), time.Minute, ""); err == nil {
		t.Error("a secret shorter than 32 bytes must be rejected")
	}
	if _, err := NewSigner(testSecret, 0, ""); err == nil {
		t.Error("a non-positive ttl must be rejected")
	}
}

func TestSignVerifyRoundTrip(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	s := newTestSigner(t, &now)

	token, err := s.Sign("att-1", "user-1", "hh-1")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := s.Verify("att-1", token)
	if err != nil {
		t.Fatalf("Verify() error = %v", err)
	}
	if claims.UserID != "user-1" || claims.HouseholdID != "hh-1" {
		t.Errorf("claims = %+v", claims)
	}
}

func TestVerifyRejectsExpiredToken(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	s := newTestSigner(t, &now)
	token, _ := s.Sign("att-1", "user-1", "hh-1")

	now = now.Add(14 * time.Minute)
	if _, err := s.Verify("att-1", token); err != nil {
		t.Fatalf("token must still be valid before the ttl elapsed: %v", err)
	}
	now = now.Add(time.Minute)
	if _, err := s.Verify("att-1", token); !errors.Is(err, ErrExpiredToken) {
		t.Fatalf("Verify() error = %v, want ErrExpiredToken", err)
	}
}

func TestVerifyRejectsTamperedToken(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	s := newTestSigner(t, &now)
	token, _ := s.Sign("att-1", "user-1", "hh-1")
	parts := strings.Split(token, ".")

	otherUser, _ := s.Sign("att-1", "user-2", "hh-1")
	otherHousehold, _ := s.Sign("att-1", "user-1", "hh-2")

	cases := map[string]string{
		"other user identity":      strings.Join([]string{strings.Split(otherUser, ".")[0], parts[1], parts[2], parts[3]}, "."),
		"other household identity": strings.Join([]string{parts[0], strings.Split(otherHousehold, ".")[1], parts[2], parts[3]}, "."),
		"extended expiry":          strings.Join([]string{parts[0], parts[1], "9999999999", parts[3]}, "."),
		"flipped signature":        strings.Join([]string{parts[0], parts[1], parts[2], flipFirst(parts[3])}, "."),
	}
	for name, tampered := range cases {
		if _, err := s.Verify("att-1", tampered); !errors.Is(err, ErrBadSignature) {
			t.Errorf("%s: Verify() error = %v, want ErrBadSignature", name, err)
		}
	}
}

func TestVerifyRejectsTokenForOtherAttachment(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	s := newTestSigner(t, &now)
	token, _ := s.Sign("att-1", "user-1", "hh-1")
	if _, err := s.Verify("att-2", token); !errors.Is(err, ErrBadSignature) {
		t.Fatalf("Verify() error = %v, want ErrBadSignature", err)
	}
}

func TestVerifyRejectsTokenFromOtherSecret(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	s := newTestSigner(t, &now)
	token, _ := s.Sign("att-1", "user-1", "hh-1")

	other, err := NewSigner([]byte("ffffffffffffffffffffffffffffffff"), time.Minute, "")
	if err != nil {
		t.Fatal(err)
	}
	other.now = s.now
	if _, err := other.Verify("att-1", token); !errors.Is(err, ErrBadSignature) {
		t.Fatalf("Verify() error = %v, want ErrBadSignature", err)
	}
}

func TestVerifyRejectsMalformedTokens(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	s := newTestSigner(t, &now)
	for _, token := range []string{"", "a.b.c", "a.b.c.d.e", "!!.b.1.c", "YQ.b!.1.c", "YQ.Yg.notanumber.c", "YQ.Yg.1.!!"} {
		if _, err := s.Verify("att-1", token); !errors.Is(err, ErrMalformedToken) {
			t.Errorf("Verify(%q) error = %v, want ErrMalformedToken", token, err)
		}
	}
}

func TestSignRequiresIdentity(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	s := newTestSigner(t, &now)
	for _, args := range [][3]string{{"", "u", "h"}, {"a", "", "h"}, {"a", "u", ""}} {
		if _, err := s.Sign(args[0], args[1], args[2]); err == nil {
			t.Errorf("Sign(%v) must fail", args)
		}
	}
}

func TestURLShape(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	s := newTestSigner(t, &now)
	raw, err := s.URL("att-1", "user-1", "hh-1")
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if u.Scheme != "https" || u.Host != "alfheim.example" || u.Path != "/api/v1/chat/attachments/att-1/content" {
		t.Errorf("url = %s", raw)
	}
	if _, err := s.Verify("att-1", u.Query().Get("token")); err != nil {
		t.Errorf("token in URL does not verify: %v", err)
	}

	relative, _ := NewSigner(testSecret, time.Minute, "")
	rel, _ := relative.URL("att-1", "u", "h")
	if !strings.HasPrefix(rel, "/api/v1/chat/attachments/att-1/content?token=") {
		t.Errorf("relative url = %s", rel)
	}
}

// flipFirst changes the first character of a base64url string to a different valid one.
func flipFirst(s string) string {
	if s[0] == 'A' {
		return "B" + s[1:]
	}
	return "A" + s[1:]
}
