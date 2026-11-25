// Package media is the server-neutral layer over the household's LAN media
// servers (#961): the MediaStatus DTO the dashboard and kiosk widgets read, the
// capability interfaces a media plugin implements, and the HTTP API for now
// playing and playback control.
//
// Alfheim only reads status and sends control calls. Media streams stay on the
// LAN between the player and the server and are never proxied or transcoded.
package media

import (
	"context"
	"errors"
	"regexp"

	"alfheim/dashboard/internal/features/plugins"
)

// State is the playback state of one session.
type State string

// Playback states.
const (
	StatePlaying State = "playing"
	StatePaused  State = "paused"
)

// Status is one active playback session, independent of the server type, so
// a summary widget never needs to know which plugin reported it.
type Status struct {
	// Source is the plugin type that reported the session, for example "jellyfin".
	Source string `json:"source"`
	// SessionID addresses the session in a control call.
	SessionID string `json:"session_id"`
	Title     string `json:"title"`
	Artist    string `json:"artist"`
	Device    string `json:"device"`
	State     State  `json:"state"`
	// CanControl is true when the server accepts remote control of the session.
	CanControl bool `json:"can_control"`
}

// Command is a playback control command.
type Command string

// Control commands accepted by POST /api/v1/integrations/media/{type}/sessions/{id}/{command}.
const (
	CommandPlayPause Command = "play_pause"
	CommandNext      Command = "next"
	CommandPrevious  Command = "previous"
	CommandStop      Command = "stop"
)

// Valid reports whether c is a known command.
func (c Command) Valid() bool {
	switch c {
	case CommandPlayPause, CommandNext, CommandPrevious, CommandStop:
		return true
	}
	return false
}

// sessionIDPattern bounds a session id before it becomes a path segment of an
// upstream URL.
var sessionIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

// Source is the capability of a plugin that reports what is playing. The
// plugin uses the netguard client it was constructed with.
type Source interface {
	NowPlaying(ctx context.Context, cfg plugins.Config, creds plugins.Credentials) ([]Status, error)
}

// Controller is the capability of a plugin that controls playback remotely.
type Controller interface {
	Control(ctx context.Context, cfg plugins.Config, creds plugins.Credentials, sessionID string, cmd Command) error
}

// Errors a media plugin returns, wrapped with context. Callers match them
// with errors.Is.
var (
	// ErrAuthFailed means the server rejected the stored credentials.
	ErrAuthFailed = errors.New("media server rejected the credentials")
	// ErrSessionNotFound means the server does not know the session.
	ErrSessionNotFound = errors.New("media session not found")
	// ErrUpstream means the server answered with an unexpected status or body.
	ErrUpstream = errors.New("media server returned an unexpected response")
	// ErrMissingCredentials means the plugin has no stored credentials.
	ErrMissingCredentials = errors.New("media plugin has no stored credentials")
)

// Errors of the media service.
var (
	// ErrNotMediaType means the type is not a registered media source.
	ErrNotMediaType = errors.New("plugin type is not a media server")
	// ErrControlUnsupported means the server type has no remote control.
	ErrControlUnsupported = errors.New("media server does not support playback control")
	// ErrInvalidCommand means the command is not one of the Command values.
	ErrInvalidCommand = errors.New("unknown media command")
	// ErrInvalidSession means the session id has an invalid shape.
	ErrInvalidSession = errors.New("invalid media session id")
)
