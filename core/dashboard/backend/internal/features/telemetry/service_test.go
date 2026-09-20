package telemetry_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"alfheim/dashboard/internal/features/telemetry"
)

func TestTelemetryService_GetMetrics_Unreachable(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	// Unreachable VictoriaMetrics URL -- must yield an explicit unavailable
	// state, never fabricated numbers.
	svc := telemetry.NewService("http://invalid-victoriametrics-host:9999", logger)
	ctx := context.Background()

	metrics, err := svc.GetMetrics(ctx)
	if err != nil {
		t.Fatalf("expected unavailable state to be returned without error, got: %v", err)
	}

	if metrics == nil {
		t.Fatal("expected non-nil metrics response")
	}
	if metrics.Available {
		t.Error("expected Available=false when victoriametrics is unreachable")
	}
	if metrics.Message == "" {
		t.Error("expected a human-readable unavailable message")
	}
	if metrics.CPUPercent != nil {
		t.Errorf("expected CPUPercent to be nil, got %v", *metrics.CPUPercent)
	}
	if metrics.MemoryPercent != nil {
		t.Errorf("expected MemoryPercent to be nil, got %v", *metrics.MemoryPercent)
	}
	if metrics.NetworkRxMbps != nil || metrics.NetworkTxMbps != nil {
		t.Error("expected network fields to be nil when unreachable")
	}
	if metrics.UptimeSeconds < 0 {
		t.Errorf("expected non-negative UptimeSeconds, got %d", metrics.UptimeSeconds)
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

// vmHandler builds a fake VictoriaMetrics /api/v1/query endpoint. values maps
// a PromQL query string to the scalar it should report; queries not present
// answer with an empty (successful) result vector.
func vmHandler(values map[string]float64) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/query" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		query := r.URL.Query().Get("query")
		w.Header().Set("Content-Type", "application/json")
		if v, ok := values[query]; ok {
			fmt.Fprintf(w, `{"status":"success","data":{"resultType":"vector","result":[{"metric":{},"value":[1700000000,"%v"]}]}}`, v)
			return
		}
		_, _ = w.Write([]byte(`{"status":"success","data":{"resultType":"vector","result":[]}}`))
	}
}

func TestTelemetryService_LiveVictoriaClients(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx := context.Background()

	t.Run("queryVictoriaMetrics with full host metrics available", func(t *testing.T) {
		ts := httptest.NewServer(vmHandler(map[string]float64{
			`count(up == 1)`: 4,
			`100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`: 42.5,
			`node_memory_MemTotal_bytes`:                                       16 * 1024 * 1024 * 1024,
			`node_memory_MemAvailable_bytes`:                                   8 * 1024 * 1024 * 1024,
			`sum(rate(node_network_receive_bytes_total{device!="lo"}[5m]))`:    1_000_000,
			`sum(rate(node_network_transmit_bytes_total{device!="lo"}[5m]))`:   500_000,
		}))
		defer ts.Close()

		svc := telemetry.NewService(ts.URL, logger)
		metrics, err := svc.GetMetrics(ctx)
		if err != nil {
			t.Fatalf("expected live metrics success, got %v", err)
		}
		if metrics == nil || !metrics.Available {
			t.Fatalf("expected Available=true metrics, got %+v", metrics)
		}
		if metrics.CPUPercent == nil || *metrics.CPUPercent != 42.5 {
			t.Errorf("expected CPUPercent 42.5, got %v", metrics.CPUPercent)
		}
		if metrics.MemoryTotalGB == nil || *metrics.MemoryTotalGB != 16 {
			t.Errorf("expected MemoryTotalGB 16, got %v", metrics.MemoryTotalGB)
		}
		if metrics.MemoryUsedGB == nil || *metrics.MemoryUsedGB != 8 {
			t.Errorf("expected MemoryUsedGB 8, got %v", metrics.MemoryUsedGB)
		}
		if metrics.NetworkRxMbps == nil || *metrics.NetworkRxMbps != 8 {
			t.Errorf("expected NetworkRxMbps 8, got %v", metrics.NetworkRxMbps)
		}
		if metrics.ActiveContainers == nil || *metrics.ActiveContainers != 4 {
			t.Errorf("expected ActiveContainers 4, got %v", metrics.ActiveContainers)
		}
	})

	t.Run("queryVictoriaMetrics reachable but no host metrics configured", func(t *testing.T) {
		// Only the liveness query ("up") answers -- no node-exporter-style
		// metrics exist. The endpoint must report Available=true (VM itself
		// is up) but leave every numeric field nil, never fabricate one.
		ts := httptest.NewServer(vmHandler(map[string]float64{
			`count(up == 1)`: 1,
		}))
		defer ts.Close()

		svc := telemetry.NewService(ts.URL, logger)
		metrics, err := svc.GetMetrics(ctx)
		if err != nil {
			t.Fatalf("expected success, got %v", err)
		}
		if !metrics.Available {
			t.Error("expected Available=true since victoriametrics itself answered")
		}
		if metrics.CPUPercent != nil || metrics.MemoryPercent != nil {
			t.Errorf("expected no fabricated CPU/memory data, got %+v", metrics)
		}
		if metrics.Message == "" {
			t.Error("expected an explanatory message when no host metrics are available")
		}
	})

	t.Run("queryVictoriaMetrics non-200 returns unavailable state", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer ts.Close()

		svc := telemetry.NewService(ts.URL, logger)
		metrics, err := svc.GetMetrics(ctx)
		if err != nil {
			t.Fatalf("expected unavailable state without error, got %v", err)
		}
		if metrics == nil || metrics.Available {
			t.Fatalf("expected Available=false, got %+v", metrics)
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

func TestMetricsResponse_JSONOmitsUnsetFields(t *testing.T) {
	resp := &telemetry.MetricsResponse{Available: false, Message: "victoriametrics is unreachable", UptimeSeconds: 5}
	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	for _, field := range []string{"cpu_percent", "memory_percent", "memory_used_gb", "memory_total_gb", "network_rx_mbps", "network_tx_mbps", "active_containers"} {
		if _, present := raw[field]; present {
			t.Errorf("expected field %q to be omitted when unset, got %v", field, raw[field])
		}
	}
	if raw["available"] != false {
		t.Errorf("expected available=false, got %v", raw["available"])
	}
}
