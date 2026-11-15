package apps

import "strings"

// AllAppsValue is the ALFHEIM_ENABLED_APPS value that enables every app.
// compose.prod.yaml passes it when the installation's .env has no
// ALFHEIM_ENABLED_APPS, so an installation from before the Lean Core keeps
// listing every app, exactly like the installer's default.
const AllAppsValue = "all"

// alwaysEnabled lists the Tier-1 tiles of the Lean Core. They are shown
// whatever ALFHEIM_ENABLED_APPS says, because the installer cannot switch
// them off.
var alwaysEnabled = map[string]bool{"household": true}

// EnabledApps is the set of optional apps the installation runs, parsed once
// at startup from ALFHEIM_ENABLED_APPS (ADR 0007) and injected into the
// registry. The zero value enables only the Lean Core.
type EnabledApps struct {
	all   bool
	names map[string]bool
}

// AllApps returns the set that enables every app.
func AllApps() EnabledApps { return EnabledApps{all: true} }

// ParseEnabledApps reads a comma-separated ALFHEIM_ENABLED_APPS value. The
// value "all" enables every app; an empty value is the Lean Core. Names are
// case-insensitive; unknown names are kept but never match a registry entry,
// so they are ignored rather than rejected (the installer validates the set).
func ParseEnabledApps(value string) EnabledApps {
	if strings.EqualFold(strings.TrimSpace(value), AllAppsValue) {
		return AllApps()
	}
	names := map[string]bool{}
	for _, raw := range strings.Split(value, ",") {
		if name := strings.ToLower(strings.TrimSpace(raw)); name != "" {
			names[name] = true
		}
	}
	return EnabledApps{names: names}
}

// Has reports whether the app with the given registry ID is enabled.
func (e EnabledApps) Has(id string) bool {
	id = strings.ToLower(id)
	return e.all || alwaysEnabled[id] || e.names[id]
}

// EnabledCoreApps returns the Tier-1 registry entries in enabled, in
// registry order. The result is a fresh slice the caller may keep.
func EnabledCoreApps(enabled EnabledApps) []AppItem {
	out := make([]AppItem, 0, len(CoreApps))
	for _, app := range CoreApps {
		if enabled.Has(app.ID) {
			out = append(out, app)
		}
	}
	return out
}
