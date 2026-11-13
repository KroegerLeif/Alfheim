package apps

import (
	"errors"
	"reflect"
	"strings"
	"testing"
)

func TestCatalogTiers(t *testing.T) {
	for _, a := range Catalog() {
		wantCore := a.Name == "dashboard" || a.Name == "household"
		if (a.Tier == TierCore) != wantCore {
			t.Errorf("%s: tier %s, want core=%v", a.Name, a.Tier, wantCore)
		}
		if len(a.Services) == 0 {
			t.Errorf("%s: no compose services", a.Name)
		}
		for _, req := range a.Requires {
			if _, ok := Lookup(req); !ok {
				t.Errorf("%s requires unknown app %s", a.Name, req)
			}
		}
	}
	if _, ok := Lookup("todo"); ok {
		t.Error("Lookup found an app that does not exist")
	}
}

func TestEnabled(t *testing.T) {
	tests := []struct {
		name    string
		env     map[string]string
		want    []string
		wantErr error
	}{
		{"missing key means all", map[string]string{}, All().Names(), nil},
		{"empty value is the Lean Core", map[string]string{EnvKey: ""}, []string{"dashboard", "household"}, nil},
		{"list", map[string]string{EnvKey: " Pantry, shopping ,chat"},
			[]string{"dashboard", "household", "pantry", "shopping", "chat"}, nil},
		{"core names are ignored", map[string]string{EnvKey: "household,budget"},
			[]string{"dashboard", "household", "budget"}, nil},
		{"unknown", map[string]string{EnvKey: "pantry,todo"}, nil, ErrUnknownApp},
		{"broken dependency", map[string]string{EnvKey: "shopping"}, nil, ErrDependency},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Enabled(tt.env)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr != nil {
				return
			}
			if !reflect.DeepEqual(got.Names(), tt.want) {
				t.Errorf("Names() = %v, want %v", got.Names(), tt.want)
			}
		})
	}
}

func TestEnableDisable(t *testing.T) {
	lean := Lean()
	withPantry, _ := Parse("pantry")
	withShopping, _ := Parse("pantry,shopping")

	tests := []struct {
		name    string
		op      func(Set, string) (Set, error)
		set     Set
		app     string
		want    string
		wantErr error
	}{
		{"enable", Enable, lean, "budget", "budget", nil},
		{"enable is idempotent", Enable, withPantry, "pantry", "pantry", nil},
		{"enable needs dependency", Enable, lean, "shopping", "", ErrDependency},
		{"enable with dependency", Enable, withPantry, "shopping", "pantry,shopping", nil},
		{"enable unknown", Enable, lean, "todo", "", ErrUnknownApp},
		{"enable core is a no-op", Enable, lean, "household", "", nil},
		{"disable", Disable, withPantry, "pantry", "", nil},
		{"disable is idempotent", Disable, lean, "chat", "", nil},
		{"disable core", Disable, lean, "dashboard", "", ErrCoreApp},
		{"disable required app", Disable, withShopping, "pantry", "", ErrDependency},
		{"disable dependent", Disable, withShopping, "shopping", "pantry", nil},
		{"disable unknown", Disable, lean, "todo", "", ErrUnknownApp},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.op(tt.set, tt.app)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr == nil && got.String() != tt.want {
				t.Errorf("String() = %q, want %q", got.String(), tt.want)
			}
		})
	}
	if lean.Has("budget") {
		t.Error("Enable mutated its input set")
	}
}

func TestAllAndOptional(t *testing.T) {
	all := All()
	if got := len(all.Optional()); got != 9 {
		t.Errorf("All() has %d optional apps, want 9 (8 apps and telemetry)", got)
	}
	if !all.Has(Telemetry) {
		t.Error("All() lacks telemetry")
	}
	if got := Lean().String(); got != "" {
		t.Errorf("Lean().String() = %q, want empty", got)
	}
}

func TestProfilesAndEnvValues(t *testing.T) {
	s, err := Parse("pantry,shopping,telemetry")
	if err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(s.Profiles(), ","); got != "pantry,shopping,telemetry" {
		t.Errorf("Profiles() = %q", got)
	}
	if got := strings.Join(s.Disabled(), ","); got != "budget,chores,library,workout,maintenance,chat" {
		t.Errorf("Disabled() = %q", got)
	}
	kv := EnvValues(s, true)
	if kv[EnvKey] != "pantry,shopping,telemetry" || kv[ProfilesKey] != "pantry,shopping,telemetry" || kv[OTELEnabledKey] != "true" {
		t.Errorf("EnvValues = %v", kv)
	}
	if kv := EnvValues(Lean(), false); kv[ProfilesKey] != "" || len(kv) != 2 {
		t.Errorf("Lean EnvValues = %v", kv)
	}
	tel, _ := Lookup(Telemetry)
	if got := tel.ContainerNames(); len(got) != len(tel.Services) || got[5] != "vector-shipper" {
		t.Errorf("telemetry containers = %v", got)
	}
	pantry, _ := Lookup("pantry")
	if got := pantry.ContainerNames(); got[0] != "pantry-backend" {
		t.Errorf("pantry containers = %v", got)
	}
}
