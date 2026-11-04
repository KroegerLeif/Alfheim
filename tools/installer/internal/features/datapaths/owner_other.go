//go:build !unix

package datapaths

import "os"

func ownerOf(os.FileInfo) (uid, gid int, ok bool) { return 0, 0, false }

func sameFilesystemAsRoot(string) (bool, error) { return false, nil }
