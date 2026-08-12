package apps

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// StackAppsLoader parses server-level Tier 2 Stack Apps configuration from YAML.
type StackAppsLoader interface {
	LoadStackApps() ([]StackAppConfig, error)
}

type stackAppsLoader struct {
	filePath string
	log      *slog.Logger
}

// NewStackAppsLoader initializes a StackAppsLoader with the provided path.
func NewStackAppsLoader(filePath string, log *slog.Logger) StackAppsLoader {
	return &stackAppsLoader{
		filePath: filePath,
		log:      log,
	}
}

func (l *stackAppsLoader) LoadStackApps() ([]StackAppConfig, error) {
	// Attempt resolving relative paths if default file not found directly
	candidatePaths := []string{
		l.filePath,
		filepath.Join(".", l.filePath),
		filepath.Join("..", l.filePath),
		filepath.Join("..", "..", l.filePath),
	}

	var data []byte
	var err error
	var finalPath string

	for _, p := range candidatePaths {
		if data, err = os.ReadFile(p); err == nil {
			finalPath = p
			break
		}
	}

	if err != nil || len(data) == 0 {
		l.log.Warn("stack-apps.yaml not found or unreadable; returning empty stack apps",
			slog.String("configured_path", l.filePath),
		)
		return []StackAppConfig{}, nil
	}

	var yamlRoot StackAppsYaml
	if err := yaml.Unmarshal(data, &yamlRoot); err != nil {
		return nil, fmt.Errorf("failed to parse stack apps yaml file at %s: %w", finalPath, err)
	}

	l.log.Debug("loaded stack apps from yaml config",
		slog.String("path", finalPath),
		slog.Int("count", len(yamlRoot.Apps)),
	)

	return yamlRoot.Apps, nil
}
