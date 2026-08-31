package apps_test

import (
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"alfheim/dashboard/internal/features/apps"
)

func TestStackAppsLoader(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	t.Run("returns empty slice when file does not exist", func(t *testing.T) {
		loader := apps.NewStackAppsLoader("non-existent-file-path-xyz.yaml", logger)
		stackApps, err := loader.LoadStackApps()
		if err != nil {
			t.Fatalf("unexpected error loading non-existent file: %v", err)
		}
		if len(stackApps) != 0 {
			t.Errorf("expected 0 stack apps, got %d", len(stackApps))
		}
	})

	t.Run("loads stack apps successfully from YAML file", func(t *testing.T) {
		tmpDir := t.TempDir()
		filePath := filepath.Join(tmpDir, "stack-apps.yaml")
		yamlContent := `
apps:
  - id: app-1
    title: App One
    url: https://app1.test
    category: tools
    icon: tool
    roles: ["admin"]
`
		if err := os.WriteFile(filePath, []byte(yamlContent), 0644); err != nil {
			t.Fatalf("failed to write temp yaml file: %v", err)
		}

		loader := apps.NewStackAppsLoader(filePath, logger)
		stackApps, err := loader.LoadStackApps()
		if err != nil {
			t.Fatalf("unexpected error loading stack apps: %v", err)
		}
		if len(stackApps) != 1 {
			t.Fatalf("expected 1 stack app, got %d", len(stackApps))
		}
		if stackApps[0].ID != "app-1" || stackApps[0].Title != "App One" {
			t.Errorf("unexpected stack app data: %+v", stackApps[0])
		}
	})

	t.Run("returns error when YAML parsing fails", func(t *testing.T) {
		tmpDir := t.TempDir()
		filePath := filepath.Join(tmpDir, "invalid-stack-apps.yaml")
		invalidYAML := `
apps:
  - id: app-1
    invalid_yaml_structure: : :
`
		if err := os.WriteFile(filePath, []byte(invalidYAML), 0644); err != nil {
			t.Fatalf("failed to write invalid temp yaml file: %v", err)
		}

		loader := apps.NewStackAppsLoader(filePath, logger)
		_, err := loader.LoadStackApps()
		if err == nil {
			t.Fatal("expected YAML unmarshal error, got nil")
		}
	})
}
