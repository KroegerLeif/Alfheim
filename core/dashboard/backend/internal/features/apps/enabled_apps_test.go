package apps_test

import (
	"testing"

	"alfheim/dashboard/internal/features/apps"
)

func ids(items []apps.AppItem) map[string]bool {
	out := map[string]bool{}
	for _, it := range items {
		out[it.ID] = true
	}
	return out
}

func TestEnabledCoreApps_AllListsEveryTile(t *testing.T) {
	got := apps.EnabledCoreApps(apps.ParseEnabledApps("all"))
	if len(got) != len(apps.CoreApps) {
		t.Fatalf("got %d tiles, want %d", len(got), len(apps.CoreApps))
	}
	if len(apps.EnabledCoreApps(apps.AllApps())) != len(apps.CoreApps) {
		t.Error("AllApps must list every tile")
	}
}

func TestEnabledCoreApps_LeanCoreKeepsHousehold(t *testing.T) {
	got := ids(apps.EnabledCoreApps(apps.ParseEnabledApps("")))
	if len(got) != 1 || !got["household"] {
		t.Errorf("Lean Core tiles = %v, want only household", got)
	}
	if !ids(apps.EnabledCoreApps(apps.EnabledApps{}))["household"] {
		t.Error("the zero value must still list household")
	}
}

func TestEnabledCoreApps_SubsetAndUnknownNames(t *testing.T) {
	got := ids(apps.EnabledCoreApps(apps.ParseEnabledApps(" Pantry , chat,unknown-app,,")))
	want := map[string]bool{"pantry": true, "chat": true, "household": true}
	if len(got) != len(want) {
		t.Fatalf("tiles = %v, want %v", got, want)
	}
	for id := range want {
		if !got[id] {
			t.Errorf("missing tile %q", id)
		}
	}
}

func TestEnabledCoreApps_KeepsRegistryOrder(t *testing.T) {
	got := apps.EnabledCoreApps(apps.ParseEnabledApps("library,pantry"))
	if len(got) != 3 || got[0].ID != "pantry" || got[1].ID != "library" || got[2].ID != "household" {
		t.Errorf("unexpected order: %v", got)
	}
}
