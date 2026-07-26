// Package logger provides structured JSON logging using Go's standard log/slog package.
package logger

import (
	"log/slog"
	"os"
	"strings"
)

// Init initializes the global slog logger based on the environment configuration.
func Init(environment string) *slog.Logger {
	var handler slog.Handler

	opts := &slog.HandlerOptions{
		AddSource: environment == "development",
		Level:     slog.LevelInfo,
	}

	if strings.ToLower(environment) == "development" {
		opts.Level = slog.LevelDebug
	}

	handler = slog.NewJSONHandler(os.Stdout, opts)
	log := slog.New(handler)
	slog.SetDefault(log)

	return log
}
