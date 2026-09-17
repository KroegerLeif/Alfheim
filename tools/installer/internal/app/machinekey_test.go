package app

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"alfheim/installer/internal/shared/paths"
)

func TestMachineKeyPreparer_RootChownsTheDirectory(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}

	var chownedPath string
	var chownedUID, chownedGID int
	p := MachineKeyPreparer{
		Geteuid: func() int { return 0 },
		Chown: func(path string, uid, gid int) error {
			chownedPath, chownedUID, chownedGID = path, uid, gid
			return nil
		},
	}

	if err := p.Prepare(layout); err != nil {
		t.Fatalf("Prepare() error = %v", err)
	}
	if chownedPath != layout.ZitadelMachineKeyDir() {
		t.Errorf("chowned %q, want %q", chownedPath, layout.ZitadelMachineKeyDir())
	}
	if chownedUID != zitadelUID || chownedGID != zitadelGID {
		t.Errorf("chowned to %d:%d, want %d:%d", chownedUID, chownedGID, zitadelUID, zitadelGID)
	}
	if info, err := os.Stat(layout.ZitadelMachineKeyDir()); err != nil || !info.IsDir() {
		t.Errorf("machinekey dir was not created: %v", err)
	}
}

func TestMachineKeyPreparer_RootChownFailurePropagates(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	sentinel := errors.New("chown failed")

	p := MachineKeyPreparer{
		Geteuid: func() int { return 0 },
		Chown:   func(string, int, int) error { return sentinel },
	}

	err := p.Prepare(layout)
	if err == nil || !errors.Is(err, sentinel) {
		t.Fatalf("Prepare() error = %v, want it to wrap %v", err, sentinel)
	}
}

func TestMachineKeyPreparer_MkdirFailurePropagates(t *testing.T) {
	root := t.TempDir()
	// Put a regular file where the machinekey directory tree needs to go,
	// so MkdirAll fails.
	blocker := filepath.Join(root, "infrastructure")
	if err := os.WriteFile(blocker, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	layout := paths.Layout{Root: root}
	p := MachineKeyPreparer{Geteuid: func() int { return 0 }}

	if err := p.Prepare(layout); err == nil {
		t.Fatal("Prepare() error = nil, want the MkdirAll failure to surface")
	}
}

func TestMachineKeyPreparer_NonRootWritableDirSucceeds(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	if err := os.MkdirAll(layout.ZitadelMachineKeyDir(), 0o700); err != nil {
		t.Fatal(err)
	}

	// A non-root euid whose Stat reports the directory as owned by the
	// Zitadel uid with the owner-write bit set (as it would be after an
	// earlier root run's chown).
	p := MachineKeyPreparer{
		Geteuid: func() int { return 1000 },
		Stat: func(path string) (os.FileInfo, error) {
			return fakeFileInfo{mode: 0o700, uid: zitadelUID, gid: zitadelGID}, nil
		},
	}
	if err := p.Prepare(layout); err != nil {
		t.Fatalf("Prepare() error = %v, want a dir already owned by the Zitadel user to pass", err)
	}
}

func TestMachineKeyPreparer_NonRootUnwritableDirFailsWithClearMessage(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	if err := os.MkdirAll(layout.ZitadelMachineKeyDir(), 0o700); err != nil {
		t.Fatal(err)
	}

	// Simulate a euid that owns nothing on this directory (not the file
	// owner uid, not gid 1000, and the mode is 0700 so "other" cannot write
	// either) by using the injectable Stat to report a synthetic owner.
	p := MachineKeyPreparer{
		Geteuid: func() int { return 1000 }, // non-root, so the write-check path runs
		Stat: func(path string) (os.FileInfo, error) {
			return fakeFileInfo{mode: 0o700, uid: 0, gid: 0}, nil
		},
	}

	err := p.Prepare(layout)
	if err == nil {
		t.Fatal("Prepare() error = nil, want an unwritable directory to fail")
	}
	if !strings.Contains(err.Error(), "not writable by the Zitadel container user") {
		t.Errorf("error = %v, want a clear explanation", err)
	}
	if !strings.Contains(err.Error(), "chown 1000:1000") {
		t.Errorf("error = %v, want the fix command named", err)
	}
}

func TestMachineKeyPreparer_StatFailurePropagates(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	sentinel := errors.New("stat failed")

	p := MachineKeyPreparer{
		Geteuid: func() int { return 1000 },
		Stat:    func(string) (os.FileInfo, error) { return nil, sentinel },
	}

	err := p.Prepare(layout)
	if err == nil || !errors.Is(err, sentinel) {
		t.Fatalf("Prepare() error = %v, want it to wrap %v", err, sentinel)
	}
}

func TestWritableByZitadelUser(t *testing.T) {
	tests := []struct {
		name string
		info fakeFileInfo
		want bool
	}{
		{"owner is zitadel, owner-writable", fakeFileInfo{mode: 0o700, uid: zitadelUID, gid: 0}, true},
		{"owner is zitadel, not owner-writable", fakeFileInfo{mode: 0o500, uid: zitadelUID, gid: 0}, false},
		{"group is zitadel, group-writable", fakeFileInfo{mode: 0o070, uid: 0, gid: zitadelGID}, true},
		{"group is zitadel, not group-writable", fakeFileInfo{mode: 0o050, uid: 0, gid: zitadelGID}, false},
		{"world-writable", fakeFileInfo{mode: 0o777, uid: 0, gid: 0}, true},
		{"root-owned 0755 (the bug)", fakeFileInfo{mode: 0o755, uid: 0, gid: 0}, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := writableByZitadelUser(tc.info); got != tc.want {
				t.Errorf("writableByZitadelUser() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestWritableByZitadelUser_NonUnixStatIsNotWritable(t *testing.T) {
	if writableByZitadelUser(nonUnixFileInfo{}) {
		t.Error("writableByZitadelUser() = true for a FileInfo with no syscall.Stat_t, want false")
	}
}

// fakeFileInfo implements os.FileInfo with an injectable syscall.Stat_t, so
// writableByZitadelUser can be tested without real files owned by arbitrary
// uids (which the test process cannot create).
type fakeFileInfo struct {
	mode     os.FileMode
	uid, gid uint32
}

func (f fakeFileInfo) Name() string       { return "machinekey" }
func (f fakeFileInfo) Size() int64        { return 0 }
func (f fakeFileInfo) Mode() os.FileMode  { return f.mode }
func (f fakeFileInfo) ModTime() time.Time { return time.Time{} }
func (f fakeFileInfo) IsDir() bool        { return true }
func (f fakeFileInfo) Sys() any           { return &syscall.Stat_t{Uid: f.uid, Gid: f.gid} }

// nonUnixFileInfo has a Sys() that is not a *syscall.Stat_t, simulating a
// platform where that type assertion fails.
type nonUnixFileInfo struct{ fakeFileInfo }

func (nonUnixFileInfo) Sys() any { return "not a stat_t" }
