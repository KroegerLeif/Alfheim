// Package datapaths handles the optional host directories that hold the
// stack's persistent data. By default every data class lives in a Docker named
// volume; setting an absolute path turns it into a bind mount, for example to
// put the database on its own disk.
package datapaths

import (
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"
)

// Class describes one kind of persistent data and how its container expects
// the directory to be owned.
type Class struct {
	// Key is the .env variable compose.prod.yaml reads.
	Key string
	// Flag is the installer command line flag.
	Flag string
	// Title is the human readable name used in prompts and messages.
	Title string
	// VolumeName is the named volume used when no path is set.
	VolumeName string
	// UID and GID own the directory: the user the container process runs as.
	UID, GID int
	// Mode is the directory permission.
	Mode fs.FileMode
}

// Classes are the configurable data classes, in the order they are shown.
// The owners were read from the images pinned in compose.prod.yaml:
// postgres:18-alpine runs as postgres (70), rustfs/rustfs as rustfs (10001),
// and the VictoriaMetrics / VictoriaLogs images run as root. The PostgreSQL
// directory is mounted at /var/lib/postgresql, so the cluster itself lives in
// its 18/docker subdirectory; the entrypoint creates that as root and hands it
// to uid 70.
var Classes = []Class{
	{Key: "ALFHEIM_DB_DATA_PATH", Flag: "db-data-path", Title: "PostgreSQL data", VolumeName: "postgres_core_data", UID: 70, GID: 70, Mode: 0o700},
	{Key: "ALFHEIM_OBJECT_DATA_PATH", Flag: "object-data-path", Title: "Object storage (RustFS) data", VolumeName: "rustfs_data", UID: 10001, GID: 10001, Mode: 0o700},
	{Key: "ALFHEIM_METRICS_DATA_PATH", Flag: "metrics-data-path", Title: "Metrics (VictoriaMetrics) data", VolumeName: "victoriametrics_data", UID: 0, GID: 0, Mode: 0o755},
	{Key: "ALFHEIM_LOGS_DATA_PATH", Flag: "logs-data-path", Title: "Logs (VictoriaLogs) data", VolumeName: "victorialogs_data", UID: 0, GID: 0, Mode: 0o755},
}

// Paths maps a Class.Key to the host directory chosen for it. A missing or
// empty entry means the class keeps its named volume.
type Paths map[string]string

// Configured returns the classes that have a host directory, in Classes order.
func (p Paths) Configured() []Class {
	var out []Class
	for _, c := range Classes {
		if p[c.Key] != "" {
			out = append(out, c)
		}
	}
	return out
}

// FromEnv picks the data path variables out of an .env map.
func FromEnv(env map[string]string) Paths {
	p := Paths{}
	for _, c := range Classes {
		if v := strings.TrimSpace(env[c.Key]); v != "" {
			p[c.Key] = v
		}
	}
	return p
}

// Merge returns p with every unset class filled from fallback. It is how an
// earlier run's choice survives a re-run that does not mention it.
func (p Paths) Merge(fallback Paths) Paths {
	out := Paths{}
	for _, c := range Classes {
		if v := strings.TrimSpace(p[c.Key]); v != "" {
			out[c.Key] = v
		} else if v := fallback[c.Key]; v != "" {
			out[c.Key] = v
		}
	}
	return out
}

// Validate checks that every configured path is a usable absolute directory
// and that no two classes share one. It does not touch the filesystem.
func (p Paths) Validate() error {
	seen := map[string]string{}
	for _, c := range p.Configured() {
		raw := p[c.Key]
		if !filepath.IsAbs(raw) {
			return fmt.Errorf("datapaths: %s (%s) must be an absolute path, got %q; "+
				"leave it empty to keep the named volume %s", c.Title, c.Key, raw, c.VolumeName)
		}
		if strings.ContainsAny(raw, ":\n\r\x00") {
			return fmt.Errorf("datapaths: %s (%s) must not contain ':' or control characters: %q",
				c.Title, c.Key, raw)
		}
		clean := filepath.Clean(raw)
		if clean == string(filepath.Separator) {
			return fmt.Errorf("datapaths: %s (%s) must not be the filesystem root", c.Title, c.Key)
		}
		if other, dup := seen[clean]; dup {
			return fmt.Errorf("datapaths: %s and %s both use %s; every data class needs its own directory",
				other, c.Title, clean)
		}
		seen[clean] = c.Title
	}
	return nil
}
