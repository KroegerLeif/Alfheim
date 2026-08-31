package telemetry_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
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

func TestTelemetryService_LiveVictoriaClients(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx := context.Background()

	t.Run("queryVictoriaMetrics success", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/v1/query" {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"status":"success"}`))
				return
			}
			w.WriteHeader(http.StatusNotFound)
		}))
		defer ts.Close()

		svc := telemetry.NewService(ts.URL, logger)
		metrics, err := svc.GetMetrics(ctx)
		if err != nil {
			t.Fatalf("expected live metrics success, got %v", err)
		}
		if metrics == nil {
			t.Fatal("expected non-nil metrics")
		}
	})

	t.Run("queryVictoriaMetrics non-200 returns error and triggers fallback", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer ts.Close()

		svc := telemetry.NewService(ts.URL, logger)
		metrics, err := svc.GetMetrics(ctx)
		if err != nil {
			t.Fatalf("expected fallback success, got %v", err)
		}
		if metrics == nil {
			t.Fatal("expected non-nil metrics")
		}
	})

	t.Run("queryVictoriaLogs parsing stream success", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/select/logsql/query" {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"_msg":"hello world","_time":"2023-01-01T00:00:00Z","service_name":"auth-service","severity":"warn"}
{"message":"second message"}
{"foo":"bar"}`))
				return
			}
			w.WriteHeader(http.StatusNotFound)
		}))
		defer ts.Close()

		t.Setenv("VICTORIALOGS_URL", ts.URL)
		svc := telemetry.NewService(ts.URL, logger)
		logsResp, err := svc.GetLogs(ctx)
		if err != nil {
			t.Fatalf("expected live logs success, got %v", err)
		}
		if logsResp.Total != 3 {
			t.Errorf("expected 3 log entries, got %d", logsResp.Total)
		}
		if logsResp.Logs[0].Service != "auth-service" || logsResp.Logs[0].Level != "WARN" {
			t.Errorf("unexpected entry 0: %+v", logsResp.Logs[0])
		}
		if logsResp.Logs[1].Service != "system" || logsResp.Logs[1].Level != "INFO" {
			t.Errorf("unexpected entry 1: %+v", logsResp.Logs[1])
		}
	})

	t.Run("queryVictoriaLogs empty response triggers fallback", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		svc := telemetry.NewService(ts.URL, logger)
		logsResp, err := svc.GetLogs(ctx)
		if err != nil {
			t.Fatalf("expected log fallback on empty response, got %v", err)
		}
		if len(logsResp.Logs) == 0 {
			t.Fatal("expected fallback log entries")
		}
	})
}
