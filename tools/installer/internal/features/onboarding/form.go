package onboarding

import (
	"github.com/charmbracelet/huh"
)

// NewForm builds the domain step of the wizard, writing directly into c.
//
// This constructor intentionally holds no logic: every rule lives in Derive
// and Validate so that the interactive and headless paths cannot diverge.
func NewForm(c *Config) *huh.Form {
	presetOptions := make([]huh.Option[PresetID], 0, len(Presets))
	for _, p := range Presets {
		presetOptions = append(presetOptions, huh.NewOption(p.Title, p.ID))
	}

	isCustom := func() bool { return c.Preset != PresetCustom }

	return huh.NewForm(
		huh.NewGroup(
			huh.NewSelect[PresetID]().
				Title("Deployment target").
				Description("Choose a preset or configure your own domain.").
				Options(presetOptions...).
				Value(&c.Preset),
		),

		// The custom domain inputs are part of the same form and are hidden
		// unless the custom preset is selected.
		huh.NewGroup(
			huh.NewInput().
				Title("Base domain").
				Description("Bare domain, for example example.com.").
				Placeholder("example.com").
				Value(&c.BaseDomain).
				Validate(func(s string) error {
					return validateHost("base domain", normaliseHost(s))
				}),
			huh.NewInput().
				Title("Application host").
				Description("Host serving the dashboard. Leave empty to use the base domain.").
				Placeholder("alfheim.example.com").
				Value(&c.AppHost).
				Validate(func(s string) error {
					if s == "" {
						return nil
					}
					return validateHost("application host", normaliseHost(s))
				}),
		).WithHideFunc(isCustom),

		huh.NewGroup(
			huh.NewInput().
				Title("Administrator e-mail").
				Description("Used for ACME registration and as the Zitadel admin contact.").
				Placeholder("ops@example.com").
				Value(&c.AdminEmail),
			huh.NewInput().
				Title("Image tag").
				Description("Container image tag to deploy.").
				Placeholder(DefaultImageTag).
				Value(&c.ImageTag),
		),
	)
}
