package app

import (
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"alfheim/installer/internal/features/updater"
	"alfheim/installer/internal/shared/assets"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/system"
)

// Earlier releases rendered the S3 endpoints against a `minio` host, but the
// compose service has always been `rustfs`, so no application could reach
// object storage.
const (
	legacyS3Host  = "minio:9000"
	currentS3Host = "rustfs:9000"
)

// dockerSocketGIDKey is the .env variable holding the group id that owns the
// host's Docker socket.
const dockerSocketGIDKey = "DOCKER_SOCKET_GID"

// detectDockerSocketGID reads the socket's owning group from the host.
func detectDockerSocketGID() (string, error) {
	return system.DockerSocketGID(os.Stat, system.DockerSocketPath, system.GroupFilePath)
}

// envRepair is one planned change to .env.
type envRepair struct {
	key, from, to string
}

// planEnvRepairs computes the idempotent repairs for an existing .env and the
// warnings for problems that are not safe to fix automatically.
//
// RustFS only has its root account, so the applications' S3_ACCESS_KEY and
// S3_SECRET_KEY must equal S3_ROOT_USER and S3_ROOT_PASSWORD. An empty value
// is filled in from the root credentials. A non-empty value that differs is
// kept (it may be deliberate, for example a service account the operator
// created in RustFS) and only reported.
//
// DOCKER_SOCKET_GID is added when missing or empty, using detect, and an
// existing value is never touched.
func planEnvRepairs(env map[string]string, detect func() (string, error)) ([]envRepair, []string) {
	var repairs []envRepair
	var warnings []string

	if strings.TrimSpace(env[dockerSocketGIDKey]) == "" {
		if gid, err := detect(); err != nil {
			warnings = append(warnings, fmt.Sprintf(
				"WARNING: %s is missing from .env and could not be detected (%v). Set it to the output of: stat -c %%g %s",
				dockerSocketGIDKey, err, system.DockerSocketPath))
		} else {
			repairs = append(repairs, envRepair{dockerSocketGIDKey, env[dockerSocketGIDKey], gid})
		}
	}

	for _, key := range []string{"S3_ENDPOINT_URL", "S3_ENDPOINT"} {
		v := env[key]
		if strings.Contains(v, legacyS3Host) {
			repairs = append(repairs, envRepair{key, v, strings.ReplaceAll(v, legacyS3Host, currentS3Host)})
		}
	}

	for _, pair := range [][2]string{{"S3_ACCESS_KEY", "S3_ROOT_USER"}, {"S3_SECRET_KEY", "S3_ROOT_PASSWORD"}} {
		key, rootKey := pair[0], pair[1]
		root := env[rootKey]
		switch {
		case root == "":
			// Nothing to derive from.
		case env[key] == "":
			repairs = append(repairs, envRepair{key, "", root})
		case env[key] != root:
			warnings = append(warnings, fmt.Sprintf(
				"WARNING: %s differs from %s in .env. RustFS only accepts its root credentials unless you created "+
					"a matching account in RustFS yourself; if uploads fail with an access error, set %s to the value of %s.",
				key, rootKey, key, rootKey))
		}
	}
	return repairs, warnings
}

// repairEnvFile fixes known-broken values in an existing .env, logging every
// change. The file is backed up first (into the same timestamped directory as
// the stack files) and keeps its mode. It returns warnings for values it
// deliberately left alone.
func repairEnvFile(
	stdout io.Writer, layout paths.Layout, env map[string]string, now time.Time,
	detectGID func() (string, error),
) ([]string, error) {
	repairs, warnings := planEnvRepairs(env, detectGID)
	if len(repairs) == 0 {
		return warnings, nil
	}

	backupDir, err := updater.Backup(layout.Root, []assets.Asset{{Name: ".env", Dest: ".env", Mode: 0o600}}, now)
	if err != nil {
		return nil, fmt.Errorf("alfheim-setup: back up .env before repairing it: %w", err)
	}

	kv := make(map[string]string, len(repairs))
	for _, r := range repairs {
		kv[r.key] = r.to
	}
	if err := envfile.Update(layout.EnvFile(), kv); err != nil {
		return nil, fmt.Errorf("alfheim-setup: repair .env: %w", err)
	}

	for _, r := range repairs {
		// Secrets are never printed.
		if r.key == "S3_SECRET_KEY" {
			fmt.Fprintf(stdout, "Repaired .env: set %s to the value of S3_ROOT_PASSWORD (backup: %s)\n", r.key, backupDir)
			continue
		}
		fmt.Fprintf(stdout, "Repaired .env: %s %q -> %q (backup: %s)\n", r.key, r.from, r.to, backupDir)
	}
	return warnings, nil
}
