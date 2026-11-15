package onboarding

import (
	"fmt"

	"github.com/charmbracelet/huh"
)

// AppChoice is one optional app the wizard offers. The installer fills it
// from the app catalog, so the view holds no app names of its own.
type AppChoice struct {
	Name        string
	Title       string
	Description string
	MemoryMB    int
}

// Label is the line the multi-select shows for the choice.
func (c AppChoice) Label() string {
	return fmt.Sprintf("%s: %s (+%d MB)", c.Title, c.Description, c.MemoryMB)
}

// AppSelection is the model of the wizard's app step.
type AppSelection struct {
	// Choices are the optional apps, telemetry excluded.
	Choices []AppChoice
	// Selected holds the names of the ticked apps.
	Selected []string
	// TelemetryMemoryMB is shown next to the telemetry question.
	TelemetryMemoryMB int
	// Telemetry is the answer to the separate telemetry question.
	Telemetry bool
	// Validate rejects a selection that breaks a dependency rule. Nil
	// accepts everything.
	Validate func(selected []string) error
}

// NewAppsForm builds the app selection step, writing into sel.
func NewAppsForm(sel *AppSelection) *huh.Form {
	options := make([]huh.Option[string], 0, len(sel.Choices))
	for _, c := range sel.Choices {
		options = append(options, huh.NewOption(c.Label(), c.Name))
	}
	validate := sel.Validate
	if validate == nil {
		validate = func([]string) error { return nil }
	}

	return huh.NewForm(
		huh.NewGroup(
			huh.NewMultiSelect[string]().
				Title("Optional apps").
				Description("The dashboard and household management always run. Tick the apps to add; "+
					"change this later with `alfheim-setup apps enable|disable`.").
				Options(options...).
				Value(&sel.Selected).
				Validate(validate),
		),
		huh.NewGroup(
			huh.NewConfirm().
				Title("Enable telemetry?").
				Description(fmt.Sprintf("Metrics, logs and Grafana (+%d MB). Off keeps the install small.",
					sel.TelemetryMemoryMB)).
				Value(&sel.Telemetry),
		),
	)
}
