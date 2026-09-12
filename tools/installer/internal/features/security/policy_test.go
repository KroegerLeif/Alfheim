package security

import (
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"alfheim/installer/internal/shared/envfile"
)

func TestGenerateAll(t *testing.T) {
	got, err := GenerateAll(NewGenerator(), nil)
	if err != nil {
		t.Fatalf("GenerateAll() error = %v", err)
	}

	for _, key := range Keys() {
		value, ok := got[key]
		if !ok {
			t.Errorf("key %s was not generated", key)
			continue
		}
		if value == "" {
			t.Errorf("key %s is empty", key)
		}
	}

	if len(got["ZITADEL_MASTERKEY"]) != 32 {
		t.Errorf("masterkey length = %d, want 32", len(got["ZITADEL_MASTERKEY"]))
	}
}

func TestGenerateAllMirrorsShareOneValue(t *testing.T) {
	got, err := GenerateAll(NewGenerator(), nil)
	if err != nil {
		t.Fatal(err)
	}
	pairs := [][2]string{
		{"ZITADEL_ADMIN_PASSWORD", "ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD"},
		{"S3_ROOT_PASSWORD", "S3_SECRET_KEY"},
	}
	for _, p := range pairs {
		if got[p[0]] != got[p[1]] {
			t.Errorf("%s and %s must hold the same value", p[0], p[1])
		}
	}
}

func TestGenerateAllValuesAreUnique(t *testing.T) {
	got, err := GenerateAll(NewGenerator(), nil)
	if err != nil {
		t.Fatal(err)
	}
	// Mirrors legitimately repeat a value, so compare only primary keys.
	seen := map[string]string{}
	for _, s := range Manifest {
		if prev, dup := seen[got[s.Key]]; dup {
			t.Errorf("%s reuses the value generated for %s", s.Key, prev)
		}
		seen[got[s.Key]] = s.Key
	}
}

func TestGenerateAllPreservesExistingSecrets(t *testing.T) {
	// Rotating the masterkey of a configured instance is unrecoverable, so a
	// reconfigure run must carry every previous value forward untouched.
	existing := map[string]string{
		"ZITADEL_MASTERKEY":      "0123456789abcdef0123456789abcdef",
		"POSTGRES_PASSWORD":      "previously-generated",
		"CHAT_ENCRYPTION_KEY":    "",
		"GRAFANA_ADMIN_PASSWORD": "keep-me",
	}

	got, err := GenerateAll(NewGenerator(), existing)
	if err != nil {
		t.Fatalf("GenerateAll() error = %v", err)
	}

	if got["ZITADEL_MASTERKEY"] != existing["ZITADEL_MASTERKEY"] {
		t.Error("the masterkey must never be rotated")
	}
	if got["POSTGRES_PASSWORD"] != "previously-generated" {
		t.Error("an existing database password must be preserved")
	}
	if got["GRAFANA_ADMIN_PASSWORD"] != "keep-me" {
		t.Error("an existing Grafana password must be preserved")
	}
	// An empty previous value is treated as absent and is regenerated.
	if got["CHAT_ENCRYPTION_KEY"] == "" {
		t.Error("an empty previous value must be regenerated")
	}
}

func TestGenerateAllPropagatesGeneratorErrors(t *testing.T) {
	g := NewGeneratorWithSource(&failingReader{remaining: 0})
	if _, err := GenerateAll(g, nil); err == nil {
		t.Fatal("GenerateAll() error = nil, want the entropy failure to surface")
	}
}

func TestGenerateRejectsUnknownKind(t *testing.T) {
	_, err := generate(NewGenerator(), Secret{Key: "X", Kind: Kind(99), Size: 8})
	if err == nil {
		t.Fatal("generate() error = nil for an unknown kind")
	}
	if !strings.Contains(err.Error(), "unknown secret kind") {
		t.Fatalf("error = %v", err)
	}
}

func TestReuse(t *testing.T) {
	if _, ok := reuse(nil, "A"); ok {
		t.Error("a nil map must report no reusable value")
	}
	if _, ok := reuse(map[string]string{}, "A"); ok {
		t.Error("a missing key must report no reusable value")
	}
	if _, ok := reuse(map[string]string{"A": ""}, "A"); ok {
		t.Error("an empty value must report no reusable value")
	}
	if v, ok := reuse(map[string]string{"A": "x"}, "A"); !ok || v != "x" {
		t.Error("an existing value must be reused")
	}
}

func TestManifestHasNoDuplicateKeys(t *testing.T) {
	seen := map[string]bool{}
	for _, key := range Keys() {
		if seen[key] {
			t.Errorf("key %s appears more than once in the manifest", key)
		}
		seen[key] = true
	}
}

// secretKeyPattern matches the environment variables that hold credentials.
var secretKeyPattern = regexp.MustCompile(`^[A-Z0-9_]*(PASSWORD|SECRET|MASTERKEY|ENCRYPTION_KEY)[A-Z0-9_]*$`)

// allowedUngenerated lists secret-shaped keys that are deliberately not
// generated, with the reason they are exempt.
var allowedUngenerated = map[string]string{
	// A pure identifier, not a credential.
	"CHAT_ENCRYPTION_KEY_ID": "key version label",
}

func TestManifestCoversEveryRepositorySecret(t *testing.T) {
	// This guards against drift: adding a service with a new credential to
	// .env.example without teaching the installer to generate it would ship
	// an installation running on the committed placeholder value.
	path := filepath.Join("..", "..", "..", "..", "..", ".env.example")
	raw, err := os.Open(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			t.Skipf("repository .env.example not reachable from %s", path)
		}
		t.Fatal(err)
	}
	defer func() { _ = raw.Close() }()

	vars, err := envfile.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(vars) == 0 {
		t.Fatal("parsed .env.example is empty")
	}

	generated := map[string]bool{}
	for _, key := range Keys() {
		generated[key] = true
	}

	for key := range vars {
		if !secretKeyPattern.MatchString(key) {
			continue
		}
		if _, exempt := allowedUngenerated[key]; exempt {
			continue
		}
		if !generated[key] {
			t.Errorf("%s looks like a credential in .env.example but the "+
				"security manifest does not generate it", key)
		}
	}
}
