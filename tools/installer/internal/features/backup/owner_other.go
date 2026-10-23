//go:build !unix

package backup

import "io/fs"

// ownerOf has no numeric owner outside unix systems.
func ownerOf(fs.FileInfo) (uid, gid int) { return 0, 0 }
