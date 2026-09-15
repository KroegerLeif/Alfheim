// Package mode distinguishes a Day-1 initial installation from Day-2
// maintenance, which decides whether the configuration wizard runs and whether
// existing secrets are preserved.
package mode

import (
	"errors"
	"fmt"
	"io/fs"
	"os"

	"alfheim/installer/internal/shared/paths"
)

// Mode is the lifecycle phase the installer operates in.
type Mode int

const (
	// ModeInstall is a Day-1 install: no completion marker, whether or not a
	// stray .env is present from an earlier run that did not finish.
	ModeInstall Mode = iota
	// ModeUpdate is Day-2 maintenance: pull images and restart, no wizard.
	ModeUpdate
	// ModeReconfigure re-runs the wizard over an existing installation.
	// Existing secrets are preserved, never rotated.
	ModeReconfigure
)

// String renders the mode for logs and the TUI header.
func (m Mode) String() string {
	switch m {
	case ModeInstall:
		return "install"
	case ModeUpdate:
		return "update"
	case ModeReconfigure:
		return "reconfigure"
	default:
		return "unknown"
	}
}

// WantsWizard reports whether the interactive configuration forms should run.
func (m Mode) WantsWizard() bool {
	return m == ModeInstall || m == ModeReconfigure
}

// Detect classifies an installation root. A reconfigure request always wins,
// but only over an installation that actually exists: reconfiguring an empty
// directory is just an install.
//
// Only the completion marker counts as "installed". A .env alone is not
// enough: it is written well before the stack ever starts (see
// app.renderConfiguration), so a run that crashes anywhere between that write
// and a successful bootstrap leaves a .env with no running containers behind
// it. Treating that as ModeUpdate would send every following run straight
// into runUpdate's single-phase restart, which skips PhaseEdgeAuth entirely
// and so never waits for Zitadel's cold-start migration — it would then fail
// every dependent container with "dependency zitadel failed to start".
// Falling back to ModeInstall instead re-runs the full staged bootstrap,
// which is always safe to repeat: GenerateAll carries the .env's existing
// secrets forward rather than rotating them.
func Detect(l paths.Layout, reconfigure bool) (Mode, error) {
	markerExists, err := exists(l.Marker())
	if err != nil {
		return ModeInstall, err
	}

	switch {
	case !markerExists:
		return ModeInstall, nil
	case reconfigure:
		return ModeReconfigure, nil
	default:
		return ModeUpdate, nil
	}
}

// exists reports whether path is present, treating only a genuine absence as
// a non-error so that a permission problem is never mistaken for a fresh host.
func exists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	return false, fmt.Errorf("mode: stat %s: %w", path, err)
}
