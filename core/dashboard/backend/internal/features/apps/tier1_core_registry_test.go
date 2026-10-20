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
