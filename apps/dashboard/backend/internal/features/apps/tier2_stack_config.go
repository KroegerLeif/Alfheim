package apps

// StackAppConfig represents Tier 2 Stack Apps defined in deploy/stack-apps.yaml.
type StackAppConfig struct {
	ID            string   `yaml:"id" json:"id"`
	Title         string   `yaml:"title" json:"title"`
	Slug          string   `yaml:"slug" json:"slug"`
	Description   string   `yaml:"description" json:"description"`
	Icon          string   `yaml:"icon" json:"icon"`
	URL           string   `yaml:"url" json:"url"`
	Category      string   `yaml:"category" json:"category"`
	RequiredRoles []string `yaml:"required_roles" json:"required_roles"`
	Status        string   `yaml:"status" json:"status"`
	DisplayOrder  int      `yaml:"display_order" json:"display_order"`
}

// StackAppsYaml holds the root parsing structure for stack-apps.yaml.
type StackAppsYaml struct {
	Apps []StackAppConfig `yaml:"apps"`
}
