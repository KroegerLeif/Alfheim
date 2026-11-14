package app

import (
	"strings"
	"testing"

	"alfheim/installer/internal/features/apps"
)

// TestTelemetrySetValues checks that provision --telemetry toggles the
// telemetry module in the stored app set, not only OTEL_ENABLED.
func TestTelemetrySetValues(t *testing.T) {
	cases := []struct {
		name        string
		existing    map[string]string
		on          bool
		wantOTEL    string
		wantInSet   bool
		wantOtherOK string
	}{
		{"enable on lean core", map[string]string{apps.EnvKey: ""}, true, "true", true, ""},
		{"disable keeps other apps", map[string]string{apps.EnvKey: "pantry,telemetry"}, false, "false", false, "pantry"},
		{"legacy install without a set", map[string]string{}, false, "false", false, "chat"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := telemetrySetValues(tc.existing, tc.on)
			if err != nil {
				t.Fatal(err)
			}
			if got[apps.OTELEnabledKey] != tc.wantOTEL {
				t.Errorf("OTEL_ENABLED = %q, want %q", got[apps.OTELEnabledKey], tc.wantOTEL)
			}
			for _, key := range []string{apps.EnvKey, apps.ProfilesKey} {
				if has := strings.Contains(got[key], apps.Telemetry); has != tc.wantInSet {
					t.Errorf("%s = %q, telemetry present = %t, want %t", key, got[key], has, tc.wantInSet)
				}
				if tc.wantOtherOK != "" && !strings.Contains(got[key], tc.wantOtherOK) {
					t.Errorf("%s = %q lost %s", key, got[key], tc.wantOtherOK)
				}
			}
		})
	}
}

// TestTelemetrySetValuesRejectsBrokenSet surfaces an invalid stored set.
func TestTelemetrySetValuesRejectsBrokenSet(t *testing.T) {
	if _, err := telemetrySetValues(map[string]string{apps.EnvKey: "nope"}, true); err == nil {
		t.Fatal("want an error for an unknown app in the stored set")
	}
}
