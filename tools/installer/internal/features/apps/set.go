package apps

import (
	"errors"
	"fmt"
	"strings"
)

// EnvKey is the .env variable holding the enabled optional apps as a
// comma-separated list. A missing key means every app, so an installation
// from before the Lean Core keeps running everything after an update.
const EnvKey = "ALFHEIM_ENABLED_APPS"

// Errors returned by the set operations. They are wrapped with the app names
// involved, so callers match them with errors.Is.
var (
	// ErrUnknownApp reports a name that is not in the catalog.
	ErrUnknownApp = errors.New("unknown app")
	// ErrCoreApp reports an attempt to disable a Lean Core app.
	ErrCoreApp = errors.New("core app cannot be disabled")
	// ErrDependency reports a change that would break a Requires rule.
	ErrDependency = errors.New("dependency not satisfied")
)

// Set is an immutable set of enabled apps. Core apps are always members.
type Set struct {
	names map[string]bool
}

// newSet builds a Set from names plus every core app.
func newSet(names ...string) Set {
	s := Set{names: map[string]bool{}}
	for _, a := range catalog {
		if a.Tier == TierCore {
			s.names[a.Name] = true
		}
	}
	for _, n := range names {
		s.names[n] = true
	}
	return s
}

// All returns the set with every app enabled, the behaviour of an
// installation without ALFHEIM_ENABLED_APPS.
func All() Set {
	names := make([]string, 0, len(catalog))
	for _, a := range catalog {
		names = append(names, a.Name)
	}
	return newSet(names...)
}

// Lean returns the Lean Core: only the core apps.
func Lean() Set { return newSet() }

// Has reports whether name is enabled.
func (s Set) Has(name string) bool { return s.names[name] }

// Names returns the enabled apps in catalog order, core apps included.
func (s Set) Names() []string {
	out := make([]string, 0, len(s.names))
	for _, a := range catalog {
		if s.names[a.Name] {
			out = append(out, a.Name)
		}
	}
	return out
}

// Optional returns the enabled optional apps in catalog order.
func (s Set) Optional() []string {
	out := []string{}
	for _, a := range catalog {
		if a.Optional() && s.names[a.Name] {
			out = append(out, a.Name)
		}
	}
	return out
}

// Disabled returns the optional apps not in s, in catalog order.
func (s Set) Disabled() []string {
	out := []string{}
	for _, a := range catalog {
		if a.Optional() && !s.names[a.Name] {
			out = append(out, a.Name)
		}
	}
	return out
}

// Profiles returns the compose profiles that start exactly the apps in s.
// Every optional app's profile is named after the app; core apps have none.
// This is the one place the enabled set is turned into COMPOSE_PROFILES.
func (s Set) Profiles() []string { return s.Optional() }

// String renders the value stored in ALFHEIM_ENABLED_APPS: the enabled
// optional apps, comma-separated. Core apps are implicit.
func (s Set) String() string { return strings.Join(s.Optional(), ",") }

// Parse reads a comma-separated list of app names. Core names are accepted
// and ignored, since core apps are always enabled. Unknown names and broken
// dependencies are errors.
func Parse(value string) (Set, error) {
	var names []string
	for _, raw := range strings.Split(value, ",") {
		name := strings.ToLower(strings.TrimSpace(raw))
		if name == "" {
			continue
		}
		if _, ok := Lookup(name); !ok {
			return Set{}, fmt.Errorf("%w %q (known: %s)", ErrUnknownApp, name, strings.Join(knownNames(), ", "))
		}
		names = append(names, name)
	}
	s := newSet(names...)
	if err := s.validate(); err != nil {
		return Set{}, err
	}
	return s, nil
}

// Selection keywords accepted by ParseSelection.
const (
	// SelectAll enables every optional app and telemetry.
	SelectAll = "all"
	// SelectNone enables the Lean Core only.
	SelectNone = "none"
)

// ParseSelection reads an operator's choice: "all", "none" or a
// comma-separated list of app names as accepted by Parse.
func ParseSelection(value string) (Set, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case SelectAll:
		return All(), nil
	case SelectNone:
		return Lean(), nil
	}
	return Parse(value)
}

// Enabled returns the set stored in env. A missing key means every app.
func Enabled(env map[string]string) (Set, error) {
	value, ok := env[EnvKey]
	if !ok {
		return All(), nil
	}
	s, err := Parse(value)
	if err != nil {
		return Set{}, fmt.Errorf("%s in .env: %w", EnvKey, err)
	}
	return s, nil
}

// Enable returns s with name added. Enabling an app that is already enabled
// is a no-op; enabling one whose requirement is off is rejected.
func Enable(s Set, name string) (Set, error) {
	app, ok := Lookup(name)
	if !ok {
		return Set{}, fmt.Errorf("%w %q (known: %s)", ErrUnknownApp, name, strings.Join(knownNames(), ", "))
	}
	for _, req := range app.Requires {
		if !s.Has(req) {
			return Set{}, fmt.Errorf("%w: %s requires %s; enable %s first", ErrDependency, name, req, req)
		}
	}
	return newSet(append(s.Names(), name)...), nil
}

// Disable returns s without name. Disabling an app that is already disabled
// is a no-op; disabling a core app, or one another enabled app requires, is
// rejected.
func Disable(s Set, name string) (Set, error) {
	app, ok := Lookup(name)
	if !ok {
		return Set{}, fmt.Errorf("%w %q (known: %s)", ErrUnknownApp, name, strings.Join(knownNames(), ", "))
	}
	if !app.Optional() {
		return Set{}, fmt.Errorf("%w: %s is part of the Lean Core", ErrCoreApp, name)
	}
	for _, other := range catalog {
		if !s.Has(other.Name) {
			continue
		}
		for _, req := range other.Requires {
			if req == name {
				return Set{}, fmt.Errorf("%w: %s requires %s; disable %s first",
					ErrDependency, other.Name, name, other.Name)
			}
		}
	}
	kept := []string{}
	for _, n := range s.Names() {
		if n != name {
			kept = append(kept, n)
		}
	}
	return newSet(kept...), nil
}

// validate checks every Requires rule of the enabled apps.
func (s Set) validate() error {
	for _, a := range catalog {
		if !s.Has(a.Name) {
			continue
		}
		for _, req := range a.Requires {
			if !s.Has(req) {
				return fmt.Errorf("%w: %s requires %s", ErrDependency, a.Name, req)
			}
		}
	}
	return nil
}

// knownNames lists every catalog name for error messages.
func knownNames() []string {
	out := make([]string, 0, len(catalog))
	for _, a := range catalog {
		out = append(out, a.Name)
	}
	return out
}
