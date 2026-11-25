package main

import (
	"log/slog"
	"net/http"

	"alfheim/dashboard/internal/features/integrations/jellyfin"
	"alfheim/dashboard/internal/features/integrations/media"
	"alfheim/dashboard/internal/features/integrations/navidrome"
	"alfheim/dashboard/internal/features/plugins"
)

// mediaPlugins constructs the media server plugins (#961). client is the
// netguard client every plugin request goes through.
func mediaPlugins(client *http.Client) []plugins.Plugin {
	return []plugins.Plugin{jellyfin.New(client), navidrome.New(client)}
}

// newMediaHandler wires the now-playing and playback control API over the
// media plugins registered in pluginSvc.
func newMediaHandler(pluginSvc *plugins.Service, log *slog.Logger) *media.Handler {
	svc := media.NewService(pluginSvc, pluginSvc.Registry(), plugins.DefaultTimeout, log)
	return media.NewHandler(svc, log)
}
