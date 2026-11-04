//go:build unix

package datapaths

import (
	"os"
	"syscall"
)

func ownerOf(info os.FileInfo) (uid, gid int, ok bool) {
	st, isStat := info.Sys().(*syscall.Stat_t)
	if !isStat {
		return 0, 0, false
	}
	return int(st.Uid), int(st.Gid), true
}

// sameFilesystemAsRoot compares device ids. dir exists when this is called.
func sameFilesystemAsRoot(dir string) (bool, error) {
	dirInfo, err := os.Stat(dir)
	if err != nil {
		return false, err
	}
	rootInfo, err := os.Stat("/")
	if err != nil {
		return false, err
	}
	d, ok1 := dirInfo.Sys().(*syscall.Stat_t)
	r, ok2 := rootInfo.Sys().(*syscall.Stat_t)
	if !ok1 || !ok2 {
		return false, nil
	}
	return uint64(d.Dev) == uint64(r.Dev), nil //nolint:gosec,unconvert // Dev width differs per platform
}
