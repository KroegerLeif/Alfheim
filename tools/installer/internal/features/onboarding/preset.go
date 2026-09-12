package onboarding

// Preset describes a selectable bundle of domain defaults.
type Preset struct {
	ID          PresetID
	Title       string
	Description string
	// Apply fills c with this preset's defaults.
	Apply func(c *Config)
}

// Presets is the ordered list offered in the TUI.
var Presets = []Preset{
	{
		ID:          PresetLoegien,
		Title:       "loegien.de (maintainer default)",
		Description: "Public deployment on alfheim.loegien.de with auth.loegien.de as issuer.",
		Apply: func(c *Config) {
			c.BaseDomain = "loegien.de"
			c.AppHost = "alfheim.loegien.de"
			c.Secure = true
		},
	},
	{
		ID:          PresetCustom,
		Title:       "Custom domain",
		Description: "Supply your own base domain and application host.",
		Apply: func(c *Config) {
			c.Secure = true
		},
	},
	{
		ID:          PresetLocalhost,
		Title:       "LAN / offline (localhost)",
		Description: "No public DNS. Uses .localhost hosts and Caddy's internal CA.",
		Apply: func(c *Config) {
			c.BaseDomain = "loegien.localhost"
			c.AppHost = "alfheim.loegien.localhost"
			c.Secure = false
		},
	},
}

// Lookup returns the preset with the given ID.
func Lookup(id PresetID) (Preset, bool) {
	for _, p := range Presets {
		if p.ID == id {
			return p, true
		}
	}
	return Preset{}, false
}

// ApplyPreset resets c to the defaults of the named preset. Values the
// operator has already typed for a custom install are left alone.
func ApplyPreset(c *Config, id PresetID) bool {
	preset, ok := Lookup(id)
	if !ok {
		return false
	}
	c.Preset = id
	preset.Apply(c)
	return true
}
