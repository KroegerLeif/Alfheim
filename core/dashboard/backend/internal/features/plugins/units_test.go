package plugins

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"alfheim/go-shared/crypto"
	"alfheim/go-shared/netguard"
)

// statusProvider is a capability interface as a feature would declare it.
type statusProvider interface{ Status() string }

type capablePlugin struct{ testPlugin }

func (*capablePlugin) Status() string { return "playing" }

func TestRegistry(t *testing.T) {
	b, a := &testPlugin{typ: "b-plugin"}, &capablePlugin{testPlugin{typ: "a_plugin"}}
	r, err := NewRegistry(b, a)
	if err != nil {
		t.Fatal(err)
	}
	if got := r.Types(); len(got) != 2 || got[0] != "a_plugin" || got[1] != "b-plugin" {
		t.Fatalf("types not sorted: %v", got)
	}
	if c, ok := CapabilityOf[statusProvider](r, "a_plugin"); !ok || c.Status() != "playing" {
		t.Fatal("capability of a plugin that implements it")
	}
	if _, ok := CapabilityOf[statusProvider](r, "b-plugin"); ok {
		t.Fatal("a plugin without the capability must not report it")
	}
	if _, ok := CapabilityOf[statusProvider](r, "missing"); ok {
		t.Fatal("an unknown type has no capability")
	}

	for name, plugins := range map[string][]Plugin{
		"nil":       {nil},
		"bad type":  {&testPlugin{typ: "Bad Type"}},
		"long type": {&testPlugin{typ: strings.Repeat("a", 65)}},
		"duplicate": {&testPlugin{typ: "x"}, &testPlugin{typ: "x"}},
	} {
		if _, err := NewRegistry(plugins...); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestCipher(t *testing.T) {
	c := mustCipher(testKey, "v1")
	sealed, id, err := c.Seal(Credentials{"token": "abc"})
	if err != nil || id != "v1" || strings.Contains(string(sealed), "abc") {
		t.Fatalf("seal: %v %q", err, id)
	}
	if creds, err := c.Open(sealed, "v1"); err != nil || creds["token"] != "abc" {
		t.Fatalf("open: %v %v", creds, err)
	}
	if creds, err := c.Open(nil, ""); err != nil || len(creds) != 0 {
		t.Fatalf("empty ciphertext: %v %v", creds, err)
	}
	if _, err := c.Open(sealed, "v0"); !errors.Is(err, ErrKeyMismatch) {
		t.Fatalf("other key id: %v", err)
	}
	if _, err := c.Open([]byte("short"), "v1"); err == nil {
		t.Fatal("garbage must not decrypt")
	}
	notJSON, _ := crypto.Encrypt(testKey, "not json")
	if _, err := c.Open(notJSON, "v1"); err == nil {
		t.Fatal("a non-JSON plaintext must fail")
	}

	off := mustCipher(nil, "")
	if off.Available() {
		t.Fatal("no key means unavailable")
	}
	if _, _, err := off.Seal(Credentials{"a": "b"}); !errors.Is(err, ErrEncryptionUnavailable) {
		t.Fatalf("seal without key: %v", err)
	}
	if _, err := off.Open(sealed, "v1"); !errors.Is(err, ErrEncryptionUnavailable) {
		t.Fatalf("open without key: %v", err)
	}
	if _, err := NewCipher([]byte("short"), "v1"); err == nil {
		t.Fatal("short key")
	}
	if _, err := NewCipher(testKey, ""); err == nil {
		t.Fatal("missing key id")
	}
}

type timeoutErr struct{}

func (timeoutErr) Error() string   { return "i/o timeout" }
func (timeoutErr) Timeout() bool   { return true }
func (timeoutErr) Temporary() bool { return true }

func TestHealthFromError(t *testing.T) {
	cases := map[error]HealthStatus{
		fmt.Errorf("x: %w", netguard.ErrBlocked):      StatusHostNotAllowed,
		fmt.Errorf("x: %w", context.DeadlineExceeded): StatusTimeout,
		timeoutErr{}:                 StatusTimeout,
		errors.New("refused ?t=sec"): StatusUnreachable,
	}
	for err, want := range cases {
		h := HealthFromError(err)
		if h.Status != want || strings.Contains(h.Detail, "sec") {
			t.Errorf("%v: %+v, want %s", err, h, want)
		}
	}
}

func TestSanitizeDetail(t *testing.T) {
	got := SanitizeDetail("bad\n token abc and abcdef ", Credentials{"a": "abc", "b": "abcdef", "c": ""})
	if got != "bad token [redacted] and [redacted]" {
		t.Fatalf("got %q", got)
	}
	if long := SanitizeDetail(strings.Repeat("é", 600), nil); len([]rune(long)) != maxDetailLength {
		t.Fatalf("length %d", len([]rune(long)))
	}
}

func TestNewHTTPClient(t *testing.T) {
	c := NewHTTPClient(mustGuard(""), 2*time.Second)
	if c.Timeout != 2*time.Second || c.CheckRedirect == nil {
		t.Fatalf("unexpected client %+v", c)
	}
	if NewService(nil, nil, nil, nil, 0).timeout != DefaultTimeout {
		t.Fatal("a zero timeout must default to DefaultTimeout")
	}
}

func TestConfigDecode(t *testing.T) {
	var s testSettings
	if err := (Config{}).Decode(&s); err != nil {
		t.Fatalf("empty settings: %v", err)
	}
	if err := (Config{Settings: json.RawMessage(`{"mode":"m"}`)}).Decode(&s); err != nil || s.Mode != "m" {
		t.Fatalf("decode: %v %+v", err, s)
	}
	if err := (Config{Settings: json.RawMessage(`{"other":1}`)}).Decode(&s); err == nil {
		t.Fatal("unknown fields must be rejected")
	}
}

func TestUpdateRequestValidate(t *testing.T) {
	long := strings.Repeat("a", MaxCredentialValue+1)
	many := Credentials{}
	for i := 0; i <= MaxCredentialFields; i++ {
		many[fmt.Sprintf("k%d", i)] = "v"
	}
	cases := map[string]UpdateRequest{
		"long url":     {BaseURL: "https://x/" + strings.Repeat("a", MaxBaseURLLength)},
		"relative url": {BaseURL: "/path"},
		"user info":    {BaseURL: "https://u:p@x"},
		"query":        {BaseURL: "https://x/?token=1"},
		"array config": {Config: json.RawMessage(`[1]`)},
		"huge config":  {Config: json.RawMessage(`{"a":"` + strings.Repeat("a", MaxConfigBytes) + `"}`)},
		"long value":   {Credentials: &Credentials{"token": long}},
		"many fields":  {Credentials: &many},
	}
	for name, req := range cases {
		req.normalize()
		if req.Validate() == nil {
			t.Errorf("%s: expected a validation error", name)
		}
	}
	ok := UpdateRequest{BaseURL: " https://ha.example.com/base ", Config: json.RawMessage("null")}
	ok.normalize()
	if err := ok.Validate(); err != nil || ok.BaseURL != "https://ha.example.com/base" || string(ok.Config) != "{}" {
		t.Fatalf("valid request: %v %+v", err, ok)
	}
	if msg := NewValidationError("f", "m").Error(); msg != "invalid plugin configuration: f: m" {
		t.Fatalf("message %q", msg)
	}
}

func TestToResponse(t *testing.T) {
	if r := toResponse(View{Type: "x"}); r.Configured || r.Health.Status != StatusUnknown || string(r.Config) != "{}" || r.UpdatedAt != nil {
		t.Fatalf("unconfigured: %+v", r)
	}
	r := toResponse(View{Type: "x", Configured: true, Record: Record{HealthStatus: StatusOK}})
	if !r.Configured || string(r.Config) != "{}" || r.UpdatedAt == nil {
		t.Fatalf("configured without settings: %+v", r)
	}
}
