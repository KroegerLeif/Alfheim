package logger

import (
	"context"
	"log/slog"
	"testing"
)

func TestInit_Development(t *testing.T) {
	log := Init("development")
	if log == nil {
		t.Fatal("expected non-nil logger in development environment")
	}

	ctx := context.Background()
	if !log.Enabled(ctx, slog.LevelDebug) {
		t.Errorf("expected debug level logging to be enabled in development environment")
	}
}

func TestInit_Production(t *testing.T) {
	log := Init("production")
	if log == nil {
		t.Fatal("expected non-nil logger in production environment")
	}

	ctx := context.Background()
	if !log.Enabled(ctx, slog.LevelInfo) {
		t.Errorf("expected info level logging to be enabled in production environment")
	}
	if log.Enabled(ctx, slog.LevelDebug) {
		t.Errorf("expected debug level logging to be disabled in production environment")
	}
}
