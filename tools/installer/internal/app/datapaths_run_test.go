package app

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"alfheim/installer/internal/features/datapaths"
	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/features/tls"
	"alfheim/installer/internal/shared/envfile"
)

// rootPreparer behaves like a root run against the real filesystem, minus the
// chown the test runner could not do.
func rootPreparer(chowned map[string][2]int) *datapaths.Preparer {
	p := datapaths.NewPreparer()
	p.Geteuid = func() int { return 0 }
	p.Chown = func(path string, uid, gid int) error {
		chowned[path] = [2]int{uid, gid}
		return nil
	}
	p.SameFilesystemAsRoot = func(string) (bool, error) { return true, nil }
	return &p
}

func dataOpts(root string, dp datapaths.Paths) *Options {
	return &Options{
		NonInteractive: true, InstallDir: root, DataPaths: dp,
		Domain: "example.com", TLSStrategy: "internal", AdminEmail: "ops@example.com",
	}
}

func TestInstallWithHostDataPathsCreatesDirectoriesAndRecordsThem(t *testing.T) {
	root, data := t.TempDir(), t.TempDir()
	dp := datapaths.Paths{
		"ALFHEIM_DB_DATA_PATH":     filepath.Join(data, "db"),
		"ALFHEIM_OBJECT_DATA_PATH": filepath.Join(data, "objects"),
	}
	chowned := map[string][2]int{}
	rec := healthyDocker()
	app, stdout, stderr := newTestApp(t, dataOpts(root, dp), rec, nil)
	app.DataPathPreparer = rootPreparer(chowned)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s stderr=%s", code, stdout, stderr)
	}

	vars, err := envfile.ParseFile(filepath.Join(root, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	if vars["ALFHEIM_DB_DATA_PATH"] != dp["ALFHEIM_DB_DATA_PATH"] || vars["ALFHEIM_OBJECT_DATA_PATH"] != dp["ALFHEIM_OBJECT_DATA_PATH"] {
		t.Errorf(".env paths = %q / %q", vars["ALFHEIM_DB_DATA_PATH"], vars["ALFHEIM_OBJECT_DATA_PATH"])
	}
	if vars["ALFHEIM_LOGS_DATA_PATH"] != "" {
		t.Errorf("an unconfigured class must stay on its named volume, got %q", vars["ALFHEIM_LOGS_DATA_PATH"])
	}
	for name, owner := range map[string][2]int{"db": {70, 70}, "objects": {10001, 10001}} {
		dir := filepath.Join(data, name)
		if info, err := os.Stat(dir); err != nil || !info.IsDir() {
			t.Fatalf("%s was not created: %v", dir, err)
		}
		if chowned[dir] != owner {
			t.Errorf("%s chowned to %v, want %v", dir, chowned[dir], owner)
		}
	}
	if !strings.Contains(stderr.String(), "same filesystem as /") {
		t.Errorf("expected the same-filesystem warning, stderr=%s", stderr)
	}
}

func TestUnwritableDataPathAbortsBeforeAnyContainerStarts(t *testing.T) {
	root := t.TempDir()
	dp := datapaths.Paths{"ALFHEIM_DB_DATA_PATH": filepath.Join(t.TempDir(), "db")}
	p := rootPreparer(map[string][2]int{})
	p.WriteProbe = func(string) error { return errors.New("read-only file system") }
	rec := healthyDocker()
	app, _, stderr := newTestApp(t, dataOpts(root, dp), rec, nil)
	app.DataPathPreparer = p

	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "not writable") {
		t.Errorf("stderr = %s", stderr)
	}
	for _, c := range rec.CallStrings() {
		if strings.Contains(c, " up ") {
			t.Errorf("no container may start after a failed preflight: %s", c)
		}
	}
}

func TestRelativeDataPathIsRejected(t *testing.T) {
	app, _, stderr := newTestApp(t,
		dataOpts(t.TempDir(), datapaths.Paths{"ALFHEIM_DB_DATA_PATH": "relative/db"}), healthyDocker(), nil)
	if code := app.Run(context.Background()); code != ExitFailure || !strings.Contains(stderr.String(), "absolute") {
		t.Fatalf("code=%d stderr=%s", code, stderr)
	}
}

func TestReconfigureKeepsAnEarlierDataPath(t *testing.T) {
	root, data := t.TempDir(), t.TempDir()
	kept := filepath.Join(data, "db")
	if err := os.WriteFile(filepath.Join(root, ".env"),
		[]byte("ALFHEIM_DB_DATA_PATH="+kept+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	opts := dataOpts(root, datapaths.Paths{})
	opts.Reconfigure = true
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), nil)
	app.DataPathPreparer = rootPreparer(map[string][2]int{})

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout)
	}
	vars, err := envfile.ParseFile(filepath.Join(root, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	if vars["ALFHEIM_DB_DATA_PATH"] != kept {
		t.Errorf("ALFHEIM_DB_DATA_PATH = %q, want %q kept", vars["ALFHEIM_DB_DATA_PATH"], kept)
	}
}

func TestDryRunValidatesButDoesNotCreateDirectories(t *testing.T) {
	data := filepath.Join(t.TempDir(), "never-created")
	opts := dataOpts(t.TempDir(), datapaths.Paths{"ALFHEIM_DB_DATA_PATH": data})
	opts.DryRun = true
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), nil)
	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout)
	}
	if _, err := os.Stat(data); !os.IsNotExist(err) {
		t.Errorf("a dry run must not create %s (err=%v)", data, err)
	}
}

type askingWizard struct {
	stubWizard
	answers datapaths.Paths
	asked   bool
}

func (w *askingWizard) AskDataPaths(p datapaths.Paths) error {
	w.asked = true
	for k, v := range w.answers {
		p[k] = v
	}
	return nil
}

func interactiveStub() stubWizard {
	return stubWizard{
		on: onboarding.Config{
			Preset: onboarding.PresetCustom, BaseDomain: "wizard.example.com",
			AdminEmail: "ops@example.com",
		},
		tls: tls.Config{Strategy: tls.StrategyInternal},
	}
}

func TestInteractiveWizardAsksForDataPaths(t *testing.T) {
	data := t.TempDir()
	wiz := &askingWizard{
		stubWizard: interactiveStub(),
		answers:    datapaths.Paths{"ALFHEIM_LOGS_DATA_PATH": filepath.Join(data, "logs")},
	}
	opts := &Options{InstallDir: t.TempDir()}
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), wiz)
	app.DataPathPreparer = rootPreparer(map[string][2]int{})

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout)
	}
	if !wiz.asked {
		t.Error("the interactive wizard must ask for data locations")
	}
	vars, err := envfile.ParseFile(filepath.Join(opts.InstallDir, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	if vars["ALFHEIM_LOGS_DATA_PATH"] != filepath.Join(data, "logs") {
		t.Errorf("ALFHEIM_LOGS_DATA_PATH = %q", vars["ALFHEIM_LOGS_DATA_PATH"])
	}
}

func TestInteractiveWizardSkipsTheQuestionWhenAFlagGaveThePaths(t *testing.T) {
	wiz := &askingWizard{stubWizard: interactiveStub()}
	opts := &Options{
		InstallDir: t.TempDir(),
		DataPaths:  datapaths.Paths{"ALFHEIM_DB_DATA_PATH": filepath.Join(t.TempDir(), "db")},
	}
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), wiz)
	app.DataPathPreparer = rootPreparer(map[string][2]int{})

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout)
	}
	if wiz.asked {
		t.Error("the wizard must not ask when the paths came from flags")
	}
}

func TestParseOptionsDataPathFlagsAndEnvironment(t *testing.T) {
	t.Setenv("ALFHEIM_LOGS_DATA_PATH", "/mnt/env-logs")
	t.Setenv("ALFHEIM_DB_DATA_PATH", "/mnt/env-db")
	var stderr bytes.Buffer
	opts, err := ParseOptions([]string{"--db-data-path", "/mnt/flag-db", "--object-data-path=/mnt/obj"}, &stderr)
	if err != nil {
		t.Fatal(err)
	}
	want := datapaths.Paths{
		"ALFHEIM_DB_DATA_PATH":     "/mnt/flag-db", // flag beats environment
		"ALFHEIM_OBJECT_DATA_PATH": "/mnt/obj",
		"ALFHEIM_LOGS_DATA_PATH":   "/mnt/env-logs",
	}
	for k, v := range want {
		if opts.DataPaths[k] != v {
			t.Errorf("%s = %q, want %q", k, opts.DataPaths[k], v)
		}
	}
	if _, ok := opts.DataPaths["ALFHEIM_METRICS_DATA_PATH"]; ok {
		t.Error("unset class must stay unset")
	}
}
