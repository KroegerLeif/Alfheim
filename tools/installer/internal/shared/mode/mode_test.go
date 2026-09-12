package mode

import (
	"os"
	"testing"

	"alfheim/installer/internal/shared/paths"
)

func TestDetect(t *testing.T) {
	tests := []struct {
		name        string
		writeEnv    bool
		writeMarker bool
		reconfigure bool
		want        Mode
	}{
		{"fresh host", false, false, false, ModeInstall},
		{"fresh host with reconfigure flag", false, false, true, ModeInstall},
		{"env only", true, false, false, ModeUpdate},
		{"marker only", false, true, false, ModeUpdate},
		{"installed with reconfigure", true, true, true, ModeReconfigure},
		{"env only with reconfigure", true, false, true, ModeReconfigure},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			l := paths.Layout{Root: t.TempDir()}
			if tc.writeEnv {
				if err := os.WriteFile(l.EnvFile(), []byte("A=b"), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			if tc.writeMarker {
				if err := os.WriteFile(l.Marker(), []byte("v1"), 0o600); err != nil {
					t.Fatal(err)
				}
			}

			got, err := Detect(l, tc.reconfigure)
			if err != nil {
				t.Fatalf("Detect() error = %v", err)
			}
			if got != tc.want {
				t.Fatalf("Detect() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestModeString(t *testing.T) {
	tests := []struct {
		mode Mode
		want string
	}{
		{ModeInstall, "install"},
		{ModeUpdate, "update"},
		{ModeReconfigure, "reconfigure"},
		{Mode(99), "unknown"},
	}
	for _, tc := range tests {
		if got := tc.mode.String(); got != tc.want {
			t.Fatalf("Mode(%d).String() = %q, want %q", tc.mode, got, tc.want)
		}
	}
}

func TestWantsWizard(t *testing.T) {
	if !ModeInstall.WantsWizard() {
		t.Fatal("install must run the wizard")
	}
	if !ModeReconfigure.WantsWizard() {
		t.Fatal("reconfigure must run the wizard")
	}
	if ModeUpdate.WantsWizard() {
		t.Fatal("update must not run the wizard")
	}
}
