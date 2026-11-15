package app

import (
	"fmt"
	"strings"

	"alfheim/installer/internal/features/apps"
	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/mode"
	"alfheim/installer/internal/shared/paths"
)

// AppsAsker is implemented by wizards that can ask which optional apps to
// enable. The headless path and test doubles do not need to.
type AppsAsker interface {
	AskApps(sel *onboarding.AppSelection) error
}

// AskApps runs the app selection step. It implements AppsAsker.
func (w *TUIWizard) AskApps(sel *onboarding.AppSelection) error {
	if err := onboarding.NewAppsForm(sel).Run(); err != nil {
		return fmt.Errorf("alfheim-setup: app selection: %w", err)
	}
	return nil
}

// configureApps decides which optional apps the installation runs. --apps
// (or ALFHEIM_APPS) wins; otherwise the set an earlier run stored in .env is
// kept, and a fresh install starts from the Lean Core without telemetry. An
// existing installation without a stored set keeps every app, as before.
// The interactive wizard then asks, pre-filled with that choice.
func (a *App) configureApps(layout paths.Layout, current mode.Mode) (apps.Set, error) {
	if a.Options.Apps != "" {
		return apps.ParseSelection(a.Options.Apps)
	}

	chosen := apps.Lean()
	if previous, err := envfile.ParseFile(layout.EnvFile()); err == nil {
		if _, stored := previous[apps.EnvKey]; stored || current != mode.ModeInstall {
			if chosen, err = apps.Enabled(previous); err != nil {
				return apps.Set{}, err
			}
		}
	}

	if a.Options.NonInteractive {
		return chosen, nil
	}
	asker, ok := a.Wizard.(AppsAsker)
	if !ok {
		return chosen, nil
	}
	sel := selectionFor(chosen)
	if err := asker.AskApps(&sel); err != nil {
		return apps.Set{}, err
	}
	return setFromSelection(sel)
}

// selectionFor builds the wizard model from the catalog, pre-selecting set.
func selectionFor(set apps.Set) onboarding.AppSelection {
	sel := onboarding.AppSelection{
		Telemetry: set.Has(apps.Telemetry),
		Validate: func(selected []string) error {
			_, err := setFromSelection(onboarding.AppSelection{Selected: selected})
			return err
		},
	}
	for _, a := range apps.Catalog() {
		switch {
		case a.Name == apps.Telemetry:
			sel.TelemetryMemoryMB = a.MemoryMB
		case a.Optional():
			sel.Choices = append(sel.Choices, onboarding.AppChoice{
				Name: a.Name, Title: a.Title, Description: a.Description, MemoryMB: a.MemoryMB,
			})
			if set.Has(a.Name) {
				sel.Selected = append(sel.Selected, a.Name)
			}
		}
	}
	return sel
}

// setFromSelection turns the wizard's answers into a validated set.
func setFromSelection(sel onboarding.AppSelection) (apps.Set, error) {
	names := append([]string{}, sel.Selected...)
	if sel.Telemetry {
		names = append(names, apps.Telemetry)
	}
	return apps.Parse(strings.Join(names, ","))
}
