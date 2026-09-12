package security

import "fmt"

// Kind selects the generation strategy for a secret.
type Kind int

const (
	// KindHex produces hex characters, used where a fixed character count
	// matters (the Zitadel masterkey must be exactly 32 characters).
	KindHex Kind = iota
	// KindBase64 produces a base64 encoded key for symmetric encryption.
	KindBase64
	// KindAlnum produces an alphanumeric password safe in connection URLs.
	KindAlnum
	// KindComplex produces a password meeting the Zitadel complexity policy.
	KindComplex
)

// Secret declares how one environment variable is generated.
type Secret struct {
	// Key is the environment variable name.
	Key string
	// Kind selects the generation strategy.
	Kind Kind
	// Size is the byte count for KindHex and KindBase64, and the character
	// count for KindAlnum and KindComplex.
	Size int
	// Mirrors lists further keys that must receive the identical value,
	// because Compose wires them to the same credential.
	Mirrors []string
}

// Manifest is the complete set of generated secrets. It mirrors the variables
// that scripts/init-env.sh has historically rotated, and is asserted against
// the repository .env.example so new services cannot silently go ungenerated.
var Manifest = []Secret{
	// Postgres superuser, shared with the Zitadel database role.
	{Key: "POSTGRES_PASSWORD", Kind: KindAlnum, Size: 32},
	{Key: "ZITADEL_DB_PASSWORD", Kind: KindAlnum, Size: 32},

	// Zitadel instance secrets. The masterkey must be exactly 32 characters.
	{Key: "ZITADEL_MASTERKEY", Kind: KindHex, Size: 16},
	{
		Key:  "ZITADEL_ADMIN_PASSWORD",
		Kind: KindComplex, Size: 24,
		Mirrors: []string{"ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD"},
	},

	// Object storage.
	{Key: "S3_ROOT_PASSWORD", Kind: KindAlnum, Size: 32, Mirrors: []string{"S3_SECRET_KEY"}},

	// Per-service database credentials.
	{Key: "DASHBOARD_POSTGRES_PASSWORD", Kind: KindAlnum, Size: 32},
	{Key: "PANTRY_POSTGRES_PASSWORD", Kind: KindAlnum, Size: 32},
	{Key: "SHOPPING_POSTGRES_PASSWORD", Kind: KindAlnum, Size: 32},
	{Key: "MAINTENANCE_POSTGRES_PASSWORD", Kind: KindAlnum, Size: 32},
	{Key: "CHORES_POSTGRES_PASSWORD", Kind: KindAlnum, Size: 32},
	{Key: "BUDGET_POSTGRES_PASSWORD", Kind: KindAlnum, Size: 32},
	{Key: "CHAT_POSTGRES_PASSWORD", Kind: KindAlnum, Size: 32},
	{Key: "WORKOUT_POSTGRES_PASSWORD", Kind: KindAlnum, Size: 32},
	{Key: "LIBRARY_POSTGRES_PASSWORD", Kind: KindAlnum, Size: 32},

	// Application level encryption.
	{Key: "CHAT_ENCRYPTION_KEY", Kind: KindBase64, Size: 32},

	// Observability.
	{Key: "GRAFANA_ADMIN_PASSWORD", Kind: KindAlnum, Size: 24},
	{Key: "GRAFANA_OIDC_CLIENT_SECRET", Kind: KindAlnum, Size: 40},
}

// GenerateAll produces a value for every entry in the manifest.
//
// Existing values are never regenerated: rotating ZITADEL_MASTERKEY on a
// configured instance makes its database unreadable, so a reconfigure run must
// carry previous secrets forward untouched.
func GenerateAll(g Generator, existing map[string]string) (map[string]string, error) {
	out := make(map[string]string, len(Manifest)*2)

	for _, secret := range Manifest {
		value, preserved := reuse(existing, secret.Key)
		if !preserved {
			generated, err := generate(g, secret)
			if err != nil {
				return nil, err
			}
			value = generated
		}

		out[secret.Key] = value
		for _, mirror := range secret.Mirrors {
			out[mirror] = value
		}
	}
	return out, nil
}

// reuse reports a usable previous value for key.
func reuse(existing map[string]string, key string) (string, bool) {
	if existing == nil {
		return "", false
	}
	value, ok := existing[key]
	if !ok || value == "" {
		return "", false
	}
	return value, true
}

// generate produces a single secret according to its declared strategy.
func generate(g Generator, s Secret) (string, error) {
	var (
		value string
		err   error
	)
	switch s.Kind {
	case KindHex:
		value, err = g.Hex(s.Size)
	case KindBase64:
		value, err = g.Base64(s.Size)
	case KindAlnum:
		value, err = g.Alphanumeric(s.Size)
	case KindComplex:
		value, err = g.Complex(s.Size)
	default:
		return "", fmt.Errorf("security: unknown secret kind %d for %s", s.Kind, s.Key)
	}
	if err != nil {
		return "", fmt.Errorf("security: generate %s: %w", s.Key, err)
	}
	return value, nil
}

// Keys returns every environment variable the manifest populates, including
// mirrored keys.
func Keys() []string {
	out := make([]string, 0, len(Manifest))
	for _, s := range Manifest {
		out = append(out, s.Key)
		out = append(out, s.Mirrors...)
	}
	return out
}
