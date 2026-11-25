package plugins

import (
	"fmt"
	"regexp"
	"sort"
)

// TypePattern is the allowed shape of a plugin type: lower case letters and
// digits, optionally separated by single hyphens or underscores.
var TypePattern = regexp.MustCompile(`^[a-z0-9]+(?:[-_][a-z0-9]+)*$`)

// maxTypeLength matches the type column of household_plugins.
const maxTypeLength = 64

// Registry holds the plugin types this build supports. It is built once in
// main from explicitly constructed plugins and is read-only afterwards, so it
// is safe for concurrent use.
type Registry struct {
	byType map[string]Plugin
	types  []string
}

// NewRegistry returns a registry of plugins. A nil plugin, a type that does not
// match TypePattern or a duplicate type is a wiring mistake and fails startup.
func NewRegistry(plugins ...Plugin) (*Registry, error) {
	r := &Registry{byType: make(map[string]Plugin, len(plugins))}
	for i, p := range plugins {
		if p == nil {
			return nil, fmt.Errorf("plugin %d is nil", i)
		}
		t := p.Type()
		if !TypePattern.MatchString(t) || len(t) > maxTypeLength {
			return nil, fmt.Errorf("plugin type %q is not a valid identifier", t)
		}
		if _, dup := r.byType[t]; dup {
			return nil, fmt.Errorf("plugin type %q is registered twice", t)
		}
		r.byType[t] = p
		r.types = append(r.types, t)
	}
	sort.Strings(r.types)
	return r, nil
}

// Get returns the plugin of type t.
func (r *Registry) Get(t string) (Plugin, bool) {
	p, ok := r.byType[t]
	return p, ok
}

// Types returns every registered type in alphabetical order.
func (r *Registry) Types() []string {
	return append([]string(nil), r.types...)
}

// CapabilityOf returns the plugin of type t as the capability interface C, when
// that plugin is registered and implements C. Features declare C next to their
// own code, for example an MCP proxy interface for the Home Assistant plugin.
func CapabilityOf[C any](r *Registry, t string) (C, bool) {
	var zero C
	p, ok := r.Get(t)
	if !ok {
		return zero, false
	}
	c, ok := p.(C)
	return c, ok
}
