package templating

import (
	"strings"
	"testing"

	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/features/tls"
)

func TestRenderedCaddyfileForLeanSet(t *testing.T) {
	r, err := NewRenderer()
	if err != nil {
		t.Fatal(err)
	}
	m := model(t, onboarding.PresetLocalhost, tls.Config{Strategy: tls.StrategyInternal})
	for _, route := range m.APIRoutes() {
		m.DisabledApps = append(m.DisabledApps, route.Slug)
	}
	m.DisabledApps = append(m.DisabledApps, "telemetry")

	out, err := r.RenderCaddyfile(m)
	if err != nil {
		t.Fatal(err)
	}
	caddy := string(out)
	for _, route := range m.APIRoutes() {
		if strings.Contains(caddy, route.Upstream) || strings.Contains(caddy, route.Slug+"-frontend") {
			t.Errorf("Lean Caddyfile still proxies to %s", route.Slug)
		}
		for _, want := range []string{
			"handle /api/v1/" + route.Slug + "* {\n\t\trespond 404",
			"handle /" + route.Slug + "/api/v1* {\n\t\trespond 404",
			"handle /" + route.Slug + "* {\n\t\tredir / 302",
		} {
			if !strings.Contains(caddy, want) {
				t.Errorf("Lean Caddyfile lacks %q", want)
			}
		}
	}
	if strings.Contains(caddy, "grafana:3000") {
		t.Error("Lean Caddyfile still proxies to Grafana")
	}
	for _, core := range []string{"dashboard-backend:8080", "dashboard-frontend:3000", "household-backend:8080", "household-frontend:3000"} {
		if !strings.Contains(caddy, core) {
			t.Errorf("Lean Caddyfile lacks the core upstream %s", core)
		}
	}
}

func TestModelRouteFilters(t *testing.T) {
	m := Model{DisabledApps: []string{"pantry", "shopping"}}
	if m.AppEnabled("pantry") || !m.AppEnabled("chat") {
		t.Error("AppEnabled ignores DisabledApps")
	}
	if got := len(m.EnabledRoutes()) + len(m.DisabledRoutes()); got != len(m.APIRoutes()) {
		t.Errorf("enabled and disabled routes cover %d of %d", got, len(m.APIRoutes()))
	}
	if len(m.DisabledRoutes()) != 2 {
		t.Errorf("DisabledRoutes() = %v", m.DisabledRoutes())
	}
	if len((Model{}).DisabledRoutes()) != 0 {
		t.Error("a zero Model disables routes")
	}
}
