package telemetry

import "testing"

func TestEnabled(t *testing.T) {
	cases := []struct {
		name string
		env  map[string]string
		want bool
	}{
		{"missing key is off", map[string]string{}, false},
		{"nil map is off", nil, false},
		{"empty value is off", map[string]string{EnvKey: ""}, false},
		{"false is off", map[string]string{EnvKey: "false"}, false},
		{"garbage is off", map[string]string{EnvKey: "yes please"}, false},
		{"true is on", map[string]string{EnvKey: "true"}, true},
		{"True with spaces is on", map[string]string{EnvKey: " True "}, true},
		{"1 is on", map[string]string{EnvKey: "1"}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := Enabled(tc.env); got != tc.want {
				t.Errorf("Enabled(%v) = %v, want %v", tc.env, got, tc.want)
			}
		})
	}
}

func TestEnvValueRoundTrips(t *testing.T) {
	for _, on := range []bool{true, false} {
		if got := Enabled(map[string]string{EnvKey: EnvValue(on)}); got != on {
			t.Errorf("Enabled(EnvValue(%v)) = %v", on, got)
		}
	}
}
