package app

import (
	"fmt"
	"io"

	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/features/tls"
)

// TUIWizard is the interactive Charm huh implementation of Wizard.
type TUIWizard struct {
	out io.Writer
}

// NewTUIWizard returns the interactive wizard.
func NewTUIWizard(out io.Writer) *TUIWizard { return &TUIWizard{out: out} }

// Run drives the domain and TLS forms in sequence. The TLS form runs second
// because its certificate questions depend on the chosen domain.
func (w *TUIWizard) Run(on *onboarding.Config, tlsCfg *tls.Config) error {
	if err := onboarding.NewForm(on).Run(); err != nil {
		return fmt.Errorf("alfheim-setup: domain configuration: %w", err)
	}
	if err := tls.NewForm(tlsCfg).Run(); err != nil {
		return fmt.Errorf("alfheim-setup: TLS configuration: %w", err)
	}
	return nil
}
