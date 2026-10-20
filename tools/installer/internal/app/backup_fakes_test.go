package app

import (
	"context"
	"io"
	"strings"

	"alfheim/installer/internal/shared/runner"
)

// backupDocker wraps the recording runner and, like a real Docker daemon,
// streams a complete pg_dumpall to the command's Stdout. It embeds the
// recorder so Calls()/CallStrings() stay available to assertions.
type backupDocker struct {
	*runner.RecordingRunner
	// failDump makes pg_dumpall exit non-zero.
	failDump bool
}

func newBackupDocker() *backupDocker {
	return &backupDocker{RecordingRunner: healthyDocker()}
}

func (d *backupDocker) Run(ctx context.Context, cmd runner.Command) (runner.Result, error) {
	res, err := d.RecordingRunner.Run(ctx, cmd)
	if err != nil {
		return res, err
	}
	joined := cmd.String()
	switch {
	case strings.Contains(joined, "SHOW server_version"):
		return runner.Result{Stdout: "16.4\n"}, nil
	case strings.Contains(joined, "pg_dumpall"):
		if d.failDump {
			return runner.Result{ExitCode: 1, Stderr: "connection refused"}, nil
		}
		_, _ = io.WriteString(cmd.Stdout, "SELECT 1;\n-- PostgreSQL database cluster dump complete\n")
		return runner.Result{}, nil
	case strings.Contains(joined, "tar cf -"):
		_, _ = io.WriteString(cmd.Stdout, "MEDIA")
		return runner.Result{}, nil
	case strings.Contains(joined, "format('DROP"):
		return runner.Result{}, nil
	}
	return res, nil
}
