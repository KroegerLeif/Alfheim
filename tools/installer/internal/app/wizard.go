package app

import (
	"context"
	"fmt"
	"io"

	"github.com/charmbracelet/huh"

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

// Confirm pauses between the two bootstrap phases while the operator creates
// the initial Zitadel administrator.
func (w *TUIWizard) Confirm(ctx context.Context, authURL string) error {
	fmt.Fprintf(w.out, `
The identity provider is up and holds a certificate.

  1. Open %s
  2. Sign in with the administrator credentials from .env
     (ZITADEL_ADMIN_USER / ZITADEL_ADMIN_PASSWORD)
  3. Complete the initial onboarding

The application stack is started once you confirm below.

`, authURL)

	proceed := true
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title("Has the Zitadel administrator been created?").
				Affirmative("Yes, start the stack").
				Negative("No, stop here").
				Value(&proceed),
		),
	)

	if err := form.RunWithContext(ctx); err != nil {
		return err
	}
	if !proceed {
		return fmt.Errorf("the operator stopped before the application stack was started")
	}
	return nil
}
