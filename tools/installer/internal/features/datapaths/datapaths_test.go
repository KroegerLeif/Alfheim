package datapaths

import (
	"errors"
	"io/fs"
	"os"
	"strings"
	"testing"
)

func TestValidate(t *testing.T) {
	cases := []struct {
		name    string
		paths   Paths
		wantErr string
	}{
		{"empty keeps named volumes", Paths{}, ""},
		{"absolute paths", Paths{"ALFHEIM_DB_DATA_PATH": "/mnt/db", "ALFHEIM_OBJECT_DATA_PATH": "/mnt/obj"}, ""},
		{"relative", Paths{"ALFHEIM_DB_DATA_PATH": "data/db"}, "absolute"},
		{"bare name looks like a volume", Paths{"ALFHEIM_DB_DATA_PATH": "pgdata"}, "absolute"},
		{"colon breaks the volume spec", Paths{"ALFHEIM_DB_DATA_PATH": "/mnt/a:b"}, "':'"},
		{"root", Paths{"ALFHEIM_DB_DATA_PATH": "/"}, "root"},
		{"duplicates", Paths{"ALFHEIM_DB_DATA_PATH": "/mnt/x", "ALFHEIM_LOGS_DATA_PATH": "/mnt/x/"}, "own directory"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.paths.Validate()
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("error = %v, want it to contain %q", err, tc.wantErr)
			}
		})
	}
}

func TestFromEnvAndMerge(t *testing.T) {
	env := map[string]string{"ALFHEIM_DB_DATA_PATH": " /mnt/db ", "ALFHEIM_LOGS_DATA_PATH": "", "OTHER": "x"}
	got := FromEnv(env)
	if len(got) != 1 || got["ALFHEIM_DB_DATA_PATH"] != "/mnt/db" {
		t.Fatalf("FromEnv = %v", got)
	}
	merged := Paths{"ALFHEIM_OBJECT_DATA_PATH": "/mnt/obj"}.Merge(got)
	if merged["ALFHEIM_DB_DATA_PATH"] != "/mnt/db" || merged["ALFHEIM_OBJECT_DATA_PATH"] != "/mnt/obj" {
		t.Fatalf("Merge = %v", merged)
	}
	if override := (Paths{"ALFHEIM_DB_DATA_PATH": "/new"}).Merge(got); override["ALFHEIM_DB_DATA_PATH"] != "/new" {
		t.Fatalf("explicit value must win: %v", override)
	}
}

type fakeInfo struct{ fs.FileInfo }

type recorder struct {
	euid     int
	owner    [2]int
	ownerOK  bool
	probeErr error
	sameFS   bool
	mkdirErr error
	chowned  map[string][2]int
	chmodded map[string]os.FileMode
	made     []string
}

func (r *recorder) preparer() Preparer {
	r.chowned = map[string][2]int{}
	r.chmodded = map[string]os.FileMode{}
	return Preparer{
		Geteuid: func() int { return r.euid },
		MkdirAll: func(p string, _ os.FileMode) error {
			r.made = append(r.made, p)
			return r.mkdirErr
		},
		Chmod: func(p string, m os.FileMode) error { r.chmodded[p] = m; return nil },
		Chown: func(p string, u, g int) error { r.chowned[p] = [2]int{u, g}; return nil },
		Stat:  func(string) (os.FileInfo, error) { return fakeInfo{}, nil },
		OwnerOf: func(os.FileInfo) (int, int, bool) {
			return r.owner[0], r.owner[1], r.ownerOK
		},
		WriteProbe:           func(string) error { return r.probeErr },
		SameFilesystemAsRoot: func(string) (bool, error) { return r.sameFS, nil },
	}
}

func TestPrepareAsRootCreatesAndChownsPerClass(t *testing.T) {
	r := &recorder{euid: 0}
	paths := Paths{"ALFHEIM_DB_DATA_PATH": "/mnt/db", "ALFHEIM_OBJECT_DATA_PATH": "/mnt/obj", "ALFHEIM_METRICS_DATA_PATH": "/mnt/vm"}
	warnings, err := r.preparer().Prepare(paths)
	if err != nil || len(warnings) != 0 {
		t.Fatalf("err=%v warnings=%v", err, warnings)
	}
	if r.chowned["/mnt/db"] != [2]int{70, 70} || r.chmodded["/mnt/db"] != 0o700 {
		t.Errorf("db dir: chown=%v chmod=%v", r.chowned["/mnt/db"], r.chmodded["/mnt/db"])
	}
	if r.chowned["/mnt/obj"] != [2]int{10001, 10001} {
		t.Errorf("object dir chown = %v", r.chowned["/mnt/obj"])
	}
	if r.chowned["/mnt/vm"] != [2]int{0, 0} || r.chmodded["/mnt/vm"] != 0o755 {
		t.Errorf("metrics dir: chown=%v chmod=%v", r.chowned["/mnt/vm"], r.chmodded["/mnt/vm"])
	}
	if _, ok := r.chowned["/mnt/logs"]; ok {
		t.Error("an unconfigured class must not be touched")
	}
}

func TestPrepareUnconfiguredDoesNothing(t *testing.T) {
	r := &recorder{euid: 0}
	if w, err := r.preparer().Prepare(Paths{}); err != nil || len(w) != 0 || len(r.made) != 0 {
		t.Fatalf("w=%v err=%v made=%v", w, err, r.made)
	}
}

func TestPrepareNonRootWrongOwnerNamesTheFix(t *testing.T) {
	r := &recorder{euid: 1000, owner: [2]int{1000, 1000}, ownerOK: true}
	_, err := r.preparer().Prepare(Paths{"ALFHEIM_DB_DATA_PATH": "/mnt/db"})
	if err == nil || !strings.Contains(err.Error(), "chown 70:70 /mnt/db") {
		t.Fatalf("err = %v", err)
	}
	if len(r.chowned) != 0 {
		t.Error("a non-root run must not attempt chown")
	}
}

func TestPrepareNonRootCorrectOwnerPasses(t *testing.T) {
	r := &recorder{euid: 1000, owner: [2]int{70, 70}, ownerOK: true}
	if _, err := r.preparer().Prepare(Paths{"ALFHEIM_DB_DATA_PATH": "/mnt/db"}); err != nil {
		t.Fatal(err)
	}
}

func TestPrepareFailsWhenNotWritable(t *testing.T) {
	r := &recorder{euid: 0, probeErr: errors.New("read-only file system")}
	_, err := r.preparer().Prepare(Paths{"ALFHEIM_DB_DATA_PATH": "/mnt/db"})
	if err == nil || !strings.Contains(err.Error(), "not writable") {
		t.Fatalf("err = %v", err)
	}
}

func TestPrepareWarnsWhenOnRootFilesystem(t *testing.T) {
	r := &recorder{euid: 0, sameFS: true}
	warnings, err := r.preparer().Prepare(Paths{"ALFHEIM_DB_DATA_PATH": "/srv/db"})
	if err != nil || len(warnings) != 1 || !strings.Contains(warnings[0], "same filesystem as /") {
		t.Fatalf("warnings=%v err=%v", warnings, err)
	}
}

func TestPrepareFailsOnInvalidPathAndMkdirError(t *testing.T) {
	r := &recorder{euid: 0}
	if _, err := r.preparer().Prepare(Paths{"ALFHEIM_DB_DATA_PATH": "relative"}); err == nil {
		t.Error("relative path must be rejected")
	}
	r.mkdirErr = errors.New("permission denied")
	if _, err := r.preparer().Prepare(Paths{"ALFHEIM_DB_DATA_PATH": "/mnt/db"}); err == nil {
		t.Error("mkdir failure must be reported")
	}
}

func TestRealPreparerOnTempDir(t *testing.T) {
	dir := t.TempDir() + "/db"
	p := NewPreparer()
	if os.Geteuid() == 0 {
		t.Skip("would chown to uid 70 as root; the injected tests cover that path")
	}
	// As a normal user the directory is owned by the current user, which is not
	// uid 70, so the check must refuse it and name the fix.
	_, err := p.Prepare(Paths{"ALFHEIM_DB_DATA_PATH": dir})
	if err == nil || !strings.Contains(err.Error(), "chown 70:70") {
		t.Fatalf("err = %v", err)
	}
	if info, statErr := os.Stat(dir); statErr != nil || !info.IsDir() {
		t.Fatalf("directory was not created: %v", statErr)
	}
	if err := writeProbe(dir); err != nil {
		t.Fatalf("writeProbe: %v", err)
	}
	if same, err := sameFilesystemAsRoot(dir); err != nil {
		t.Fatalf("sameFilesystemAsRoot: %v", err)
	} else {
		_ = same
	}
}
