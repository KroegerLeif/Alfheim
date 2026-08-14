package telemetry_test

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"alfheim/dashboard/internal/features/telemetry"
)

func TestTelemetryService_GetMetricsFallback(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	// Unreachable VictoriaMetrics URL to test fallback execution
	svc := telemetry.NewService("http://invalid-victoriametrics-host:9999", logger)
	ctx := context.Background()

	metrics, err := svc.GetMetrics(ctx)
	if err != nil {
		t.Fatalf("expected fallback to succeed without error, got: %v", err)
	}

	if metrics == nil {
		t.Fatal("expected non-nil metrics response")
	}

	if metrics.CPUPercent < 0 || metrics.CPUPercent > 100 {
		t.Errorf("unexpected CPU percent: %f", metrics.CPUPercent)
	}

	if metrics.MemoryPercent < 0 || metrics.MemoryPercent > 100 {
		t.Errorf("unexpected Memory percent: %f", metrics.MemoryPercent)
	}

	if metrics.MemoryTotalGB <= 0 {
		t.Errorf("expected positive MemoryTotalGB, got %f", metrics.MemoryTotalGB)
	}

	if metrics.UptimeSeconds <= 0 {
		t.Errorf("expected positive UptimeSeconds, got %d", metrics.UptimeSeconds)
	}
}

func TestTelemetryService_GetLogsFallback(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := telemetry.NewService("http://invalid-victoriametrics-host:9999", logger)
	ctx := context.Background()

	logsResp, err := svc.GetLogs(ctx)
	if err != nil {
		t.Fatalf("expected log fallback to succeed without error, got: %v", err)
	}

	if logsResp == nil || len(logsResp.Logs) == 0 {
		t.Fatal("expected non-empty log entries in fallback response")
	}

	for _, entry := range logsResp.Logs {
		if entry.ID == "" || entry.Timestamp == "" || entry.Level == "" || entry.Message == "" {
			t.Errorf("invalid log entry: %+v", entry)
		}
	}
}
