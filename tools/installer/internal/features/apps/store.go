package apps

import (
	"strconv"

	"alfheim/installer/internal/shared/envfile"
)

// OTELEnabledKey is the .env variable the services read to decide whether to
// export telemetry. It follows the telemetry module.
const OTELEnabledKey = "OTEL_ENABLED"

// Store reads and updates the installation's .env.
type Store interface {
	// Load returns every key of the .env.
	Load() (map[string]string, error)
	// Update replaces or appends the given keys and leaves every other line
	// untouched.
	Update(kv map[string]string) error
}

// EnvFileStore is the Store backed by a dotenv file on disk.
type EnvFileStore struct {
	// Path is the .env file, usually paths.Layout.EnvFile().
	Path string
}

// Load parses the .env file.
func (e EnvFileStore) Load() (map[string]string, error) { return envfile.ParseFile(e.Path) }

// Update writes kv into the .env file in place.
func (e EnvFileStore) Update(kv map[string]string) error { return envfile.Update(e.Path, kv) }

// EnvValues returns the .env keys that record s. OTEL_ENABLED is included
// only when withTelemetry is true, so a change to another app never
// overrides a value the operator set by hand.
func EnvValues(s Set, withTelemetry bool) map[string]string {
	kv := map[string]string{EnvKey: s.String()}
	if withTelemetry {
		kv[OTELEnabledKey] = strconv.FormatBool(s.Has(Telemetry))
	}
	return kv
}
