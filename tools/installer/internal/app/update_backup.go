package app

import (
	"context"
	"fmt"

	"alfheim/installer/internal/features/backup"
	"alfheim/installer/internal/shared/paths"
)

// backupBeforeUpdate takes a database and secrets backup before anything is
// replaced or restarted, and fails the update when it cannot. The RustFS
// object storage is left out: update never touches a volume, and including
// it would make every update as slow as the media library is large; run
// `alfheim-setup backup` for a full archive.
func (u *UpdateApp) backupBeforeUpdate(ctx context.Context, layout paths.Layout) error {
	if u.Options.SkipBackup {
		fmt.Fprintln(u.Stdout, "WARNING: --skip-backup given; no database or secrets backup was taken before this update.")
		return nil
	}
	fmt.Fprintln(u.Stdout, "Backing up the database and secrets before updating...")
	svc := backup.New(u.Runner, layout, u.Build.Version, u.Stdout)
	svc.Now = u.Now
	path, err := svc.Create(ctx, backup.CreateOptions{
		OutputDir: layout.BackupDir(), Keep: backup.DefaultKeep, IncludeMedia: false,
	})
	if err != nil {
		return fmt.Errorf("alfheim-setup update: pre-update backup failed, so the update was aborted and nothing was changed "+
			"(start the stack and fix the cause, or re-run with --skip-backup to update without a backup): %w", err)
	}
	fmt.Fprintf(u.Stdout, "Pre-update backup written to %s\n\n", path)
	return nil
}
