package app

import (
	"fmt"
	"os"
	"syscall"

	"alfheim/installer/internal/shared/paths"
)

// zitadelUID and zitadelGID are the "zitadel" user baked into the
// ghcr.io/zitadel/zitadel:v2.66.1 image. Verified by extracting /etc/passwd
// from the image (`docker create` + `docker cp`, since the image ships no
// shell to run `id` in): "zitadel:x:1000:1000::/:".
const (
	zitadelUID = 1000
	zitadelGID = 1000
)

// MachineKeyPreparer prepares the host directory compose bind-mounts to
// Zitadel's /machinekey so its non-root container user can write the
// first-instance bootstrap PAT there.
//
// A bind-mount directory that does not exist yet is created by the Docker
// daemon itself — root-owned, not by the container — which denies that
// write. On a fresh Proxmox LXC the installer runs as root, so this hits
// every fresh install: Zitadel's first start fails the 03_default_instance
// migration with "open /machinekey/pat.txt: permission denied", and every
// restart after that fails again with Errors.Instance.Domain.AlreadyExists
// because the migration is half-applied.
//
// The function fields are injectable so tests do not depend on the real
// euid or on being able to chown anything.
type MachineKeyPreparer struct {
	// Geteuid reports the effective uid of the running process. Defaults to
	// os.Geteuid.
	Geteuid func() int
	// Chown changes ownership. Defaults to os.Chown.
	Chown func(path string, uid, gid int) error
	// Stat reports file info. Defaults to os.Stat.
	Stat func(path string) (os.FileInfo, error)
}

func newMachineKeyPreparer() MachineKeyPreparer {
	return MachineKeyPreparer{Geteuid: os.Geteuid, Chown: os.Chown, Stat: os.Stat}
}

// Prepare creates the machinekey directory (if needed) and ensures the
// Zitadel container's user can write to it.
func (p MachineKeyPreparer) Prepare(layout paths.Layout) error {
	dir := layout.ZitadelMachineKeyDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("alfheim-setup: create %s: %w", dir, err)
	}

	if p.Geteuid() == 0 {
		// Running as root — the common case on a fresh install — so give the
		// Zitadel container's own user ownership directly.
		if err := p.Chown(dir, zitadelUID, zitadelGID); err != nil {
			return fmt.Errorf(
				"alfheim-setup: chown %s to the Zitadel container user (uid %d): %w",
				dir, zitadelUID, err)
		}
		return nil
	}

	info, err := p.Stat(dir)
	if err != nil {
		return fmt.Errorf("alfheim-setup: stat %s: %w", dir, err)
	}
	if writableByZitadelUser(info) {
		return nil
	}
	return fmt.Errorf(
		"alfheim-setup: %s is not writable by the Zitadel container user (uid %d, gid %d), and "+
			"alfheim-setup is not running as root to fix it. Run: chown %d:%d %s (or re-run "+
			"alfheim-setup as root)",
		dir, zitadelUID, zitadelGID, zitadelUID, zitadelGID, dir)
}

// writableByZitadelUser reports whether the Zitadel container's user could
// write into a directory with this owner/group/mode: owner uid 1000 with
// the owner-write bit, group gid 1000 with the group-write bit, or anyone
// via the world-write bit.
func writableByZitadelUser(info os.FileInfo) bool {
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return false
	}
	mode := info.Mode()
	switch {
	case int(stat.Uid) == zitadelUID:
		return mode&0o200 != 0
	case int(stat.Gid) == zitadelGID:
		return mode&0o020 != 0
	default:
		return mode&0o002 != 0
	}
}
