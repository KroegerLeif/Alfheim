//go:build unix

package backup

import (
	"io/fs"
	"syscall"
)

// ownerOf returns the numeric owner of a file, so a restore as root can
// re-apply it (the Zitadel machinekey directory must stay writable by the
// container user).
func ownerOf(info fs.FileInfo) (uid, gid int) {
	if st, ok := info.Sys().(*syscall.Stat_t); ok {
		return int(st.Uid), int(st.Gid)
	}
	return 0, 0
}
