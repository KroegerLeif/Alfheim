package apps_test

import (
	"testing"

	"alfheim/dashboard/internal/features/apps"
)

// The gateway does not redirect bare app paths: each Next.js app's next-intl
// middleware picks the locale (NEXT_LOCALE cookie first). A hardcoded locale
// suffix in the registry would bypass that choice for every user.
func TestCoreApps_LinkToBareAppPath(t *testing.T) {
	for _, app := range apps.CoreApps {
		want := "/" + app.Slug
		if app.URL != want {
			t.Errorf("%s: URL = %q, want %q", app.ID, app.URL, want)
		}
		if app.AppURL != want {
			t.Errorf("%s: AppURL = %q, want %q", app.ID, app.AppURL, want)
		}
	}
}

// Every tile gets a live health state, so every registry entry needs a probe
// target.
func TestCoreApps_HaveHealthURL(t *testing.T) {
	for _, app := range apps.CoreApps {
		if url, ok := apps.HealthURL(app.ID); !ok || url == "" {
			t.Errorf("%s has no health URL", app.ID)
		}
	}
	if _, ok := apps.HealthURL("unknown"); ok {
		t.Error("unknown app must have no health URL")
	}
}
