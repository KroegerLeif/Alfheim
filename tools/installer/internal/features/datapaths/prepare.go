package datapaths

import (
	"fmt"
	"os"
	"path/filepath"
)

// Preparer creates the configured directories and checks that the stack can
// use them. The function fields are injectable so tests need neither root nor
// real chown.
type Preparer struct {
	// Geteuid reports the effective uid. Defaults to os.Geteuid.
	Geteuid func() int
	// MkdirAll, Chmod, Chown and Stat default to their os counterparts.
	MkdirAll func(path string, perm os.FileMode) error
	Chmod    func(path string, mode os.FileMode) error
	Chown    func(path string, uid, gid int) error
	Stat     func(path string) (os.FileInfo, error)
	// WriteProbe proves the directory is writable by creating and removing a
	// file. Defaults to a real probe.
	WriteProbe func(dir string) error
	// OwnerOf returns the owning uid and gid of a file. Defaults to the
	// platform implementation.
	OwnerOf func(info os.FileInfo) (uid, gid int, ok bool)
	// SameFilesystemAsRoot reports whether path is on the same filesystem as
	// "/". Defaults to a device id comparison.
	SameFilesystemAsRoot func(path string) (bool, error)
}

// NewPreparer returns a Preparer backed by the real filesystem.
func NewPreparer() Preparer {
	return Preparer{
		Geteuid:              os.Geteuid,
		MkdirAll:             os.MkdirAll,
		Chmod:                os.Chmod,
		Chown:                os.Chown,
		Stat:                 os.Stat,
		WriteProbe:           writeProbe,
		OwnerOf:              ownerOf,
		SameFilesystemAsRoot: sameFilesystemAsRoot,
	}
}

func writeProbe(dir string) error {
	f, err := os.CreateTemp(dir, ".alfheim-write-test-*")
	if err != nil {
		return err
	}
	name := f.Name()
	if err := f.Close(); err != nil {
		_ = os.Remove(name)
		return err
	}
	return os.Remove(name)
}

// Prepare creates every configured directory with the owner and mode its
// container needs and verifies it is writable. It returns warnings (a path on
// the same filesystem as "/", where the operator asked for separation) and
// fails when a directory cannot be used.
//
// As root it chowns the directory. Otherwise it can only verify: a directory
// with the wrong owner is reported with the exact chown command to run.
func (p Preparer) Prepare(paths Paths) (warnings []string, err error) {
	if err := paths.Validate(); err != nil {
		return nil, err
	}
	for _, c := range paths.Configured() {
		dir := filepath.Clean(paths[c.Key])

		if err := p.MkdirAll(dir, c.Mode); err != nil {
			return warnings, fmt.Errorf("alfheim-setup: create %s for %s: %w", dir, c.Title, err)
		}
		if p.Geteuid() == 0 {
			if err := p.Chown(dir, c.UID, c.GID); err != nil {
				return warnings, fmt.Errorf("alfheim-setup: chown %s to %d:%d for %s: %w",
					dir, c.UID, c.GID, c.Title, err)
			}
			if err := p.Chmod(dir, c.Mode); err != nil {
				return warnings, fmt.Errorf("alfheim-setup: chmod %s to %04o for %s: %w", dir, c.Mode, c.Title, err)
			}
		} else if err := p.verifyOwner(dir, c); err != nil {
			return warnings, err
		}

		if err := p.WriteProbe(dir); err != nil {
			return warnings, fmt.Errorf("alfheim-setup: %s for %s is not writable: %w", dir, c.Title, err)
		}

		if same, err := p.SameFilesystemAsRoot(dir); err == nil && same {
			warnings = append(warnings, fmt.Sprintf(
				"%s (%s) is on the same filesystem as /, so it is not separated from the system disk. "+
					"Mount the disk at %s first if that was the intent.", dir, c.Title, dir))
		}
	}
	return warnings, nil
}

// verifyOwner is the non-root path: it cannot change ownership, so the
// directory must already belong to the container user.
func (p Preparer) verifyOwner(dir string, c Class) error {
	info, err := p.Stat(dir)
	if err != nil {
		return fmt.Errorf("alfheim-setup: stat %s: %w", dir, err)
	}
	uid, gid, ok := p.OwnerOf(info)
	if !ok || (uid == c.UID && gid == c.GID) {
		return nil
	}
	return fmt.Errorf("alfheim-setup: %s for %s is owned by %d:%d but its container runs as %d:%d, "+
		"and alfheim-setup is not running as root to fix it. Run: chown %d:%d %s && chmod %04o %s "+
		"(or re-run alfheim-setup as root)",
		dir, c.Title, uid, gid, c.UID, c.GID, c.UID, c.GID, dir, c.Mode, dir)
}
