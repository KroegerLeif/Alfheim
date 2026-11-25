package plugins

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

// ErrLifecycle means a plugin's EnableObserver refused an enable or disable,
// for example because the household API could not create a service binding.
// The configuration was not stored.
var ErrLifecycle = errors.New("plugin could not complete the enable state change")

// EnableObserver is an optional capability: a plugin that sets up resources
// outside the dashboard (for example a household service binding, #958)
// implements it. Save calls it before storing a configuration whose enabled
// state changed; an error aborts the save, so the stored state never claims a
// setup that did not happen.
type EnableObserver interface {
	PluginEnabledChanged(ctx context.Context, change EnableChange) error
}

// EnableChange describes one enable state change of a household's plugin.
type EnableChange struct {
	HouseholdID uuid.UUID
	Enabled     bool
	// CallerToken is the bearer token of the OWNER or ADMIN who saved the
	// plugin, so the observer can call other Alfheim APIs as that user. It is
	// empty when the save did not come through the HTTP API.
	CallerToken string
}

type callerTokenKey struct{}

// WithCallerToken returns ctx carrying the caller's bearer token for an
// EnableObserver. The token lives only in memory for the length of the request.
func WithCallerToken(ctx context.Context, token string) context.Context {
	return context.WithValue(ctx, callerTokenKey{}, token)
}

// callerToken returns the token stored by WithCallerToken, or "".
func callerToken(ctx context.Context) string {
	token, _ := ctx.Value(callerTokenKey{}).(string)
	return token
}

// BearerToken returns the token of an "Authorization: Bearer" header, or "".
func BearerToken(r *http.Request) string {
	scheme, token, ok := strings.Cut(r.Header.Get("Authorization"), " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}

// notifyEnableChange calls the plugin's EnableObserver when the enabled state
// changes between wasEnabled and rec.Enabled.
func notifyEnableChange(ctx context.Context, plugin Plugin, wasEnabled bool, rec Record) error {
	obs, ok := plugin.(EnableObserver)
	if !ok || wasEnabled == rec.Enabled {
		return nil
	}
	change := EnableChange{HouseholdID: rec.HouseholdID, Enabled: rec.Enabled, CallerToken: callerToken(ctx)}
	if err := obs.PluginEnabledChanged(ctx, change); err != nil {
		return errors.Join(ErrLifecycle, err)
	}
	return nil
}
