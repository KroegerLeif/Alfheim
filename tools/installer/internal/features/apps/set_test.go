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
	if kv[ChatMCPServersKey] != "pantry=http://pantry-backend:8000/mcp" || kv[PantryBackendURLKey] != "http://pantry-backend:8000" {
		t.Errorf("EnvValues cross-app URLs = %v", kv)
	}
	if kv := EnvValues(Lean(), false); kv[ProfilesKey] != "" || kv[ChatMCPServersKey] != "" || kv[PantryBackendURLKey] != "" || len(kv) != 4 {
		t.Errorf("Lean EnvValues = %v", kv)
	}
	want := "pantry=http://pantry-backend:8000/mcp,chores=http://chores-backend:8000/mcp,maintenance=http://maintenance-backend:8000/mcp"
	if got := ChatMCPServers(All()); got != want {
		t.Errorf("ChatMCPServers(All()) = %q", got)
	}
	choresOnly, err := Parse("chat,chores")
	if err != nil {
		t.Fatal(err)
	}
	if got := ChatMCPServers(choresOnly); got != "chores=http://chores-backend:8000/mcp" {
		t.Errorf("ChatMCPServers(chat,chores) = %q", got)
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

func TestParseSelection(t *testing.T) {
	for _, tc := range []struct {
		in      string
		want    string
		wantErr bool
	}{
		{in: "all", want: All().String()},
		{in: " NONE ", want: ""},
		{in: "pantry,shopping", want: "pantry,shopping"},
		{in: "todo", wantErr: true},
	} {
		got, err := ParseSelection(tc.in)
		if (err != nil) != tc.wantErr {
			t.Errorf("%q: err = %v", tc.in, err)
			continue
		}
		if err == nil && got.String() != tc.want {
			t.Errorf("%q = %q, want %q", tc.in, got, tc.want)
		}
	}
	for _, a := range Catalog() {
		if a.Description == "" || a.MemoryMB <= 0 {
			t.Errorf("%s lacks wizard metadata", a.Name)
		}
	}
}
