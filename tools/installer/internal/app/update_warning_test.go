package app

import (
	"context"
	"strings"
	"testing"

	"alfheim/installer/internal/features/provisioning"
)

func TestUpdateApp_RegistrationWarningDoesNotFailAndIsInSummary(t *testing.T) {
	dir := t.TempDir()
	writeExistingInstall(t, dir, "v1.0.0")

	srv := startAssetServer(t, updateAssetContents("v1.1.0"))
	defer srv.Close()
	app, stdout, stderr := newTestUpdateApp(dir, &UpdateOptions{
		InstallDir: dir, Version: "v1.1.0", Yes: true, Repo: defaultUpdateRepo,
	}, srv)
	app.Provisioner = &stubProvisioner{result: provisioning.Result{
		ProjectID: "p", WebClientID: "w", GrafanaClientID: "g", GrafanaSecret: "s",
		Warnings: []string{"WARNING: Zitadel self-registration may still be ENABLED: forbidden"},
	}}

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("Run() = %d, want %d; stderr=%s", code, ExitOK, stderr.String())
	}
	out := stdout.String()
	if got := strings.Count(out, "may still be ENABLED"); got != 2 {
		t.Errorf("warning printed %d times, want twice (at the step and in the final summary)\n%s", got, out)
	}
	if strings.LastIndex(out, "may still be ENABLED") < strings.Index(out, "updated to v1.1.0") {
		t.Error("the warning must appear after the completion message in the final summary")
	}
}
