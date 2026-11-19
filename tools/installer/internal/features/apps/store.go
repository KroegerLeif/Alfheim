package apps

import (
	"strconv"
	"strings"

	"alfheim/installer/internal/features/telemetry"
	"alfheim/installer/internal/shared/envfile"
)

// OTELEnabledKey is the .env variable the services read to decide whether to
// export telemetry. It follows the telemetry module.
const OTELEnabledKey = telemetry.EnvKey

// ProfilesKey is the variable docker compose reads its active profiles from.
// It is stored in .env too, so a manual `docker compose up -d` in the
// installation root starts the same apps as the installer.
const ProfilesKey = "COMPOSE_PROFILES"

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

// ChatMCPServersKey is the chat backend's list of MCP servers, one per app
// that offers tools. It follows the enabled set, so chat never dials an app
// that is not installed.
const ChatMCPServersKey = "CHAT_MCP_SERVERS"

// PantryBackendURLKey is the pantry URL the shopping backend syncs with. It
// is empty while pantry is disabled, which hides the shopping sync.
const PantryBackendURLKey = "PANTRY_BACKEND_URL"

// pantryBackendURL is the pantry backend on the internal network.
const pantryBackendURL = "http://pantry-backend:8000"

// mcpServers are the apps that serve MCP tools for chat, in catalog order.
var mcpServers = []struct{ app, url string }{
	{"pantry", "http://pantry-backend:8000/mcp"},
	{"chores", "http://chores-backend:8000/mcp"},
	{"maintenance", "http://maintenance-backend:8000/mcp"},
}

// ChatMCPServers renders CHAT_MCP_SERVERS for s: app=url for every enabled
// app that offers MCP tools.
func ChatMCPServers(s Set) string {
	entries := []string{}
	for _, m := range mcpServers {
		if s.Has(m.app) {
			entries = append(entries, m.app+"="+m.url)
		}
	}
	return strings.Join(entries, ",")
}

// PantryBackendURL renders PANTRY_BACKEND_URL for s: the pantry backend when
// pantry is enabled, else empty.
func PantryBackendURL(s Set) string {
	if s.Has("pantry") {
		return pantryBackendURL
	}
	return ""
}

// EnvValues returns the .env keys that record s: ALFHEIM_ENABLED_APPS,
// COMPOSE_PROFILES and the cross-app URLs that depend on the set
// (CHAT_MCP_SERVERS, PANTRY_BACKEND_URL). OTEL_ENABLED is included
// only when withTelemetry is true, so a change to another app never
// overrides a value the operator set by hand.
func EnvValues(s Set, withTelemetry bool) map[string]string {
	kv := map[string]string{
		EnvKey:              s.String(),
		ProfilesKey:         strings.Join(s.Profiles(), ","),
		ChatMCPServersKey:   ChatMCPServers(s),
		PantryBackendURLKey: PantryBackendURL(s),
	}
	if withTelemetry {
		kv[OTELEnabledKey] = strconv.FormatBool(s.Has(Telemetry))
	}
	return kv
}
