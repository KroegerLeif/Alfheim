package onboarding

import (
	"strings"
	"testing"
)

func TestApplyPresetLoegienMatchesRepositoryDefaults(t *testing.T) {
	var c Config
	if !ApplyPreset(&c, PresetLoegien) {
		t.Fatal("ApplyPreset() = false for a known preset")
	}
	c.AdminEmail = "ops@example.com"
	if err := Derive(&c); err != nil {
		t.Fatalf("Derive() error = %v", err)
	}

	// These must stay identical to the committed .env.example defaults.
	tests := []struct{ name, got, want string }{
		{"base domain", c.BaseDomain, "loegien.de"},
		{"app host", c.AppHost, "alfheim.loegien.de"},
		{"auth host", c.AuthHost, "auth.loegien.de"},
		{"base url", c.BaseURL, "https://alfheim.loegien.de"},
		{"issuer", c.IssuerURL, "https://auth.loegien.de"},
		{"registry", c.Registry, DefaultRegistry},
		{"repo", c.Repo, DefaultRepo},
		{"tag", c.ImageTag, DefaultImageTag},
	}
	for _, tc := range tests {
		if tc.got != tc.want {
			t.Errorf("%s = %q, want %q", tc.name, tc.got, tc.want)
		}
	}
	if err := Validate(c); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestApplyPresetLocalhostIsHTTPS(t *testing.T) {
	var c Config
	ApplyPreset(&c, PresetLocalhost)
	if err := Derive(&c); err != nil {
		t.Fatal(err)
	}
	if !c.Secure {
		t.Error("the localhost preset is served over HTTPS by the locally generated CA")
	}
	if !strings.HasPrefix(c.BaseURL, "https://") || !strings.HasPrefix(c.IssuerURL, "https://") {
		t.Errorf("BaseURL = %q, IssuerURL = %q, want HTTPS URLs", c.BaseURL, c.IssuerURL)
	}
	if c.AuthHost != "auth.loegien.localhost" {
		t.Errorf("AuthHost = %q", c.AuthHost)
	}
}

func TestApplyPresetUnknown(t *testing.T) {
	var c Config
	if ApplyPreset(&c, PresetID("nope")) {
		t.Fatal("ApplyPreset() = true for an unknown preset")
	}
}

func TestLookup(t *testing.T) {
	for _, p := range Presets {
		if _, ok := Lookup(p.ID); !ok {
			t.Errorf("Lookup(%s) = false", p.ID)
		}
	}
	if _, ok := Lookup("missing"); ok {
		t.Error("Lookup(missing) = true")
	}
}

func TestDeriveNormalisesOperatorInput(t *testing.T) {
	tests := []struct {
		name              string
		in                Config
		wantBase, wantApp string
	}{
		{
			"strips scheme and trailing slash",
			Config{BaseDomain: "https://Example.COM/", AppHost: "https://app.example.com"},
			"example.com", "app.example.com",
		},
		{
			"strips a trailing dot",
			Config{BaseDomain: "example.com.", AppHost: "app.example.com."},
			"example.com", "app.example.com",
		},
		{
			"trims surrounding whitespace",
			Config{BaseDomain: "  example.com  ", AppHost: " app.example.com "},
			"example.com", "app.example.com",
		},
		{
			"falls back to the base domain when no app host is given",
			Config{BaseDomain: "example.com"},
			"example.com", "example.com",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c := tc.in
			c.Secure = true
			if err := Derive(&c); err != nil {
				t.Fatalf("Derive() error = %v", err)
			}
			if c.BaseDomain != tc.wantBase {
				t.Errorf("BaseDomain = %q, want %q", c.BaseDomain, tc.wantBase)
			}
			if c.AppHost != tc.wantApp {
				t.Errorf("AppHost = %q, want %q", c.AppHost, tc.wantApp)
			}
			if c.AuthHost != "auth."+tc.wantBase {
				t.Errorf("AuthHost = %q", c.AuthHost)
			}
		})
	}
}

func TestDeriveRequiresBaseDomain(t *testing.T) {
	c := Config{}
	if err := Derive(&c); err == nil {
		t.Fatal("Derive() error = nil for an empty base domain")
	}
}

func TestDerivePreservesExplicitImageCoordinates(t *testing.T) {
	c := Config{
		BaseDomain: "example.com", Secure: true,
		Registry: "registry.internal", Repo: "team/alfheim", ImageTag: "v1.2.3",
	}
	if err := Derive(&c); err != nil {
		t.Fatal(err)
	}
	if c.ImageReference() != "registry.internal/team/alfheim" {
		t.Errorf("ImageReference() = %q", c.ImageReference())
	}
	if c.ImageTag != "v1.2.3" {
		t.Errorf("ImageTag = %q", c.ImageTag)
	}
}

func TestValidate(t *testing.T) {
	base := func() Config {
		c := Config{Preset: PresetCustom, BaseDomain: "example.com", Secure: true, AdminEmail: "ops@example.com"}
		if err := Derive(&c); err != nil {
			t.Fatal(err)
		}
		return c
	}

	tests := []struct {
		name    string
		mutate  func(*Config)
		wantErr string
	}{
		{"valid", func(*Config) {}, ""},
		{"unknown preset", func(c *Config) { c.Preset = "nope" }, "unknown preset"},
		{"empty base domain", func(c *Config) { c.BaseDomain = "" }, "base domain is required"},
		{"scheme in host", func(c *Config) { c.AppHost = "https://x.example.com" }, "must not include a scheme"},
		{"path in host", func(c *Config) { c.AppHost = "x.example.com/app" }, "must not include a path"},
		{"port in host", func(c *Config) { c.AppHost = "x.example.com:8443" }, "must not include a port"},
		{"single label host", func(c *Config) { c.AppHost = "localhost" }, "not a valid hostname"},
		{"underscore in host", func(c *Config) { c.AppHost = "my_host.example.com" }, "not a valid hostname"},
		{"leading dash", func(c *Config) { c.AppHost = "-bad.example.com" }, "not a valid hostname"},
		{"overlong host", func(c *Config) {
			c.AppHost = strings.Repeat("a", 60) + "." + strings.Repeat("b", 60) + "." +
				strings.Repeat("c", 60) + "." + strings.Repeat("d", 60) + ".example.com"
		}, "exceeds 253 characters"},
		{"bad email", func(c *Config) { c.AdminEmail = "not-an-email" }, "is not valid"},
		{"good email", func(c *Config) { c.AdminEmail = "ops@example.com" }, ""},
		{"empty admin email", func(c *Config) { c.AdminEmail = "" }, "administrator e-mail is required"},
		{"empty tag", func(c *Config) { c.ImageTag = "" }, "image tag must not be empty"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c := base()
			tc.mutate(&c)
			err := Validate(c)
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("Validate() error = %v, want nil", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("Validate() error = nil, want one containing %q", tc.wantErr)
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("Validate() error = %v, want it to contain %q", err, tc.wantErr)
			}
		})
	}
}

func TestValidateRejectsEmptyAuthHost(t *testing.T) {
	// AuthHost is derived, so an empty value means Derive was skipped.
	c := Config{Preset: PresetCustom, BaseDomain: "example.com",
		AppHost: "example.com", ImageTag: "latest"}
	err := Validate(c)
	if err == nil || !strings.Contains(err.Error(), "auth host is required") {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestWildcardDomain(t *testing.T) {
	c := Config{BaseDomain: "loegien.de"}
	if got := c.WildcardDomain(); got != "*.loegien.de" {
		t.Fatalf("WildcardDomain() = %q", got)
	}
}

func TestHeadlessConfigFromEnv(t *testing.T) {
	env := map[string]string{
		"DOMAIN":                 "example.com",
		"ALFHEIM_HOST":           "alfheim.example.com",
		"ZITADEL_ADMIN_EMAIL":    "ops@example.com",
		"ZITADEL_EXTERNALSECURE": "true",
	}
	c, err := HeadlessConfigFromEnv(env)
	if err != nil {
		t.Fatalf("HeadlessConfigFromEnv() error = %v", err)
	}
	if c.BaseDomain != "example.com" || c.AppHost != "alfheim.example.com" ||
		c.AuthHost != "auth.example.com" || c.AdminEmail != "ops@example.com" || !c.Secure {
		t.Fatalf("HeadlessConfigFromEnv() = %+v", c)
	}
	if c.BaseURL != "https://alfheim.example.com" {
		t.Errorf("BaseURL = %q", c.BaseURL)
	}
}

func TestHeadlessConfigFromEnvInsecure(t *testing.T) {
	c, err := HeadlessConfigFromEnv(map[string]string{"DOMAIN": "example.com"})
	if err != nil {
		t.Fatal(err)
	}
	if c.Secure {
		t.Error("a missing ZITADEL_EXTERNALSECURE must default to insecure")
	}
}

func TestHeadlessConfigFromEnvUsesLiteralAuthHostAndBaseURL(t *testing.T) {
	// A dev .env can use an auth host that does not follow the
	// "auth.<domain>" convention; provisioning must target the real one.
	c, err := HeadlessConfigFromEnv(map[string]string{
		"DOMAIN":                 "loegien.de",
		"ZITADEL_EXTERNALDOMAIN": "auth.alfheim.loegien.localhost",
		"ALFHEIM_BASE_URL":       "https://alfheim.loegien.de",
	})
	if err != nil {
		t.Fatal(err)
	}
	if c.AuthHost != "auth.alfheim.loegien.localhost" {
		t.Errorf("AuthHost = %q, want the literal ZITADEL_EXTERNALDOMAIN", c.AuthHost)
	}
	if c.BaseURL != "https://alfheim.loegien.de" {
		t.Errorf("BaseURL = %q, want the literal ALFHEIM_BASE_URL", c.BaseURL)
	}
}

func TestHeadlessConfigFromEnvRequiresBaseDomain(t *testing.T) {
	if _, err := HeadlessConfigFromEnv(map[string]string{}); err == nil {
		t.Fatal("HeadlessConfigFromEnv() error = nil, want a failure for a missing domain")
	}
}

func TestScheme(t *testing.T) {
	if (Config{Secure: true}).Scheme() != "https" {
		t.Error("Scheme() with Secure=true must be https")
	}
	if (Config{Secure: false}).Scheme() != "http" {
		t.Error("Scheme() with Secure=false must be http")
	}
}
