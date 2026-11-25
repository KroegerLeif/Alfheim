package jellyfin

import (
	"context"
	"net/http"
	"net/url"

	"alfheim/dashboard/internal/features/integrations/media"
	"alfheim/dashboard/internal/features/plugins"
)

// activeWithinSeconds limits now playing to sessions seen in the last minute.
const activeWithinSeconds = "60"

// session is the part of a GET /Sessions entry the widget needs.
type session struct {
	ID                    string    `json:"Id"`
	DeviceName            string    `json:"DeviceName"`
	Client                string    `json:"Client"`
	SupportsRemoteControl bool      `json:"SupportsRemoteControl"`
	NowPlayingItem        *nowItem  `json:"NowPlayingItem"`
	PlayState             playState `json:"PlayState"`
}

type nowItem struct {
	Name        string   `json:"Name"`
	Artists     []string `json:"Artists"`
	AlbumArtist string   `json:"AlbumArtist"`
	SeriesName  string   `json:"SeriesName"`
}

type playState struct {
	IsPaused bool `json:"IsPaused"`
}

// commands maps the neutral commands to Jellyfin's playstate commands.
var commands = map[media.Command]string{
	media.CommandPlayPause: "PlayPause",
	media.CommandNext:      "NextTrack",
	media.CommandPrevious:  "PreviousTrack",
	media.CommandStop:      "Stop",
}

// NowPlaying lists the sessions active within the last minute that play an item.
func (p *Plugin) NowPlaying(ctx context.Context, cfg plugins.Config, creds plugins.Credentials) ([]media.Status, error) {
	var sessions []session
	query := url.Values{"activeWithinSeconds": {activeWithinSeconds}}
	if err := p.getJSON(ctx, cfg, creds, "/Sessions", query, &sessions); err != nil {
		return nil, err
	}
	out := make([]media.Status, 0, len(sessions))
	for _, s := range sessions {
		if s.NowPlayingItem == nil {
			continue
		}
		state := media.StatePlaying
		if s.PlayState.IsPaused {
			state = media.StatePaused
		}
		device := s.DeviceName
		if device == "" {
			device = s.Client
		}
		out = append(out, media.Status{
			Source:     Type,
			SessionID:  s.ID,
			Title:      s.NowPlayingItem.Name,
			Artist:     artistOf(s.NowPlayingItem),
			Device:     device,
			State:      state,
			CanControl: s.SupportsRemoteControl,
		})
	}
	return out, nil
}

// artistOf picks the most specific credit: track artist, album artist, series.
func artistOf(item *nowItem) string {
	if len(item.Artists) > 0 && item.Artists[0] != "" {
		return item.Artists[0]
	}
	if item.AlbumArtist != "" {
		return item.AlbumArtist
	}
	return item.SeriesName
}

// Control sends a playstate command to the session. The media service has
// already validated sessionID and cmd.
func (p *Plugin) Control(ctx context.Context, cfg plugins.Config, creds plugins.Credentials, sessionID string, cmd media.Command) error {
	name, ok := commands[cmd]
	if !ok {
		return media.ErrInvalidCommand
	}
	req, err := p.newRequest(ctx, http.MethodPost, cfg, creds,
		"/Sessions/"+url.PathEscape(sessionID)+"/Playing/"+name, nil)
	if err != nil {
		return err
	}
	resp, err := p.do(req)
	if err != nil {
		return err
	}
	drain(resp)
	return nil
}
