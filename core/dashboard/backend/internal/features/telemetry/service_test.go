package telemetry_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"alfheim/dashboard/internal/features/telemetry"
)

const gib = 1024 * 1024 * 1024

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestTelemetryService_GetMetrics_Unreachable(t *testing.T) {
	// Unreachable VictoriaMetrics URL -- must yield an explicit unavailable
	// state, never fabricated numbers.
	svc := telemetry.NewService("http://invalid-victoriametrics-host:9999", testLogger())

	metrics, err := svc.GetMetrics(context.Background())
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
	if metrics.CPUPercent != nil || metrics.MemoryPercent != nil || metrics.DiskPercent != nil {
		t.Errorf("expected no readings when unreachable, got %+v", metrics)
	}
	if metrics.UptimeSeconds != nil {
		t.Errorf("expected no uptime when unreachable, got %d", *metrics.UptimeSeconds)
	}
}

// vmHandler builds a fake VictoriaMetrics /api/v1/query endpoint. values maps
// a substring of the PromQL query to the scalar it should report; queries
// matching no entry answer with an empty (successful) result vector. The
// response is shaped like VictoriaMetrics answering a node-exporter
// aggregation (a labelled series with a [timestamp, "value"] pair).
func vmHandler(values map[string]float64) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/query" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		query := r.URL.Query().Get("query")
		w.Header().Set("Content-Type", "application/json")
		for fragment, v := range values {
			if strings.Contains(query, fragment) {
				fmt.Fprintf(w, `{"status":"success","data":{"resultType":"vector","result":[{"metric":{"instance":"node-exporter:9100","job":"node"},"value":[1700000000,"%v"]}]}}`, v)
				return
			}
		}
		_, _ = w.Write([]byte(`{"status":"success","data":{"resultType":"vector","result":[]}}`))
	}
}

func TestTelemetryService_GetMetrics_NodeExporterSeries(t *testing.T) {
	ctx := context.Background()

	t.Run("full host metrics available", func(t *testing.T) {
		ts := httptest.NewServer(vmHandler(map[string]float64{
			`node_cpu_seconds_total`:         42.5,
			`node_memory_MemTotal_bytes`:     16 * gib,
			`node_memory_MemAvailable_bytes`: 12 * gib,
			`node_filesystem_size_bytes`:     500 * gib,
			`node_filesystem_avail_bytes`:    125 * gib,
			`node_boot_time_seconds`:         93784,
		}))
		defer ts.Close()

		metrics, err := telemetry.NewService(ts.URL, testLogger()).GetMetrics(ctx)
		if err != nil {
			t.Fatalf("expected live metrics success, got %v", err)
		}
		if !metrics.Available {
			t.Fatalf("expected Available=true metrics, got %+v", metrics)
		}
		assertFloat(t, "CPUPercent", metrics.CPUPercent, 42.5)
		assertFloat(t, "MemoryTotalGB", metrics.MemoryTotalGB, 16)
		assertFloat(t, "MemoryUsedGB", metrics.MemoryUsedGB, 4)
		assertFloat(t, "MemoryPercent", metrics.MemoryPercent, 25)
		assertFloat(t, "DiskTotalGB", metrics.DiskTotalGB, 500)
		assertFloat(t, "DiskUsedGB", metrics.DiskUsedGB, 375)
		assertFloat(t, "DiskPercent", metrics.DiskPercent, 75)
		if metrics.UptimeSeconds == nil || *metrics.UptimeSeconds != 93784 {
			t.Errorf("expected host UptimeSeconds 93784, got %v", metrics.UptimeSeconds)
		}
		if metrics.Message != "" {
			t.Errorf("expected no message when readings exist, got %q", metrics.Message)
		}
	})

	t.Run("partial data leaves the missing fields nil", func(t *testing.T) {
		ts := httptest.NewServer(vmHandler(map[string]float64{
			`node_cpu_seconds_total`:     10,
			`node_memory_MemTotal_bytes`: 8 * gib,
			// MemAvailable missing: used/percent cannot be derived.
		}))
		defer ts.Close()

		metrics, err := telemetry.NewService(ts.URL, testLogger()).GetMetrics(ctx)
		if err != nil {
			t.Fatalf("expected success, got %v", err)
		}
		assertFloat(t, "CPUPercent", metrics.CPUPercent, 10)
		assertFloat(t, "MemoryTotalGB", metrics.MemoryTotalGB, 8)
		if metrics.MemoryUsedGB != nil || metrics.MemoryPercent != nil {
			t.Errorf("expected memory usage to stay nil without MemAvailable, got %+v", metrics)
		}
		if metrics.DiskPercent != nil || metrics.UptimeSeconds != nil {
			t.Errorf("expected disk and uptime to stay nil, got %+v", metrics)
		}
	})

	t.Run("reachable but no host metrics scraped yet", func(t *testing.T) {
		// Only the liveness query answers -- no node-exporter series exist.
		// The endpoint must report Available=true (VM itself is up) but
		// leave every numeric field nil, never fabricate one.
		ts := httptest.NewServer(vmHandler(map[string]float64{`vector(1)`: 1}))
		defer ts.Close()

		metrics, err := telemetry.NewService(ts.URL, testLogger()).GetMetrics(ctx)
		if err != nil {
			t.Fatalf("expected success, got %v", err)
		}
		if !metrics.Available {
			t.Error("expected Available=true since victoriametrics itself answered")
		}
		if metrics.CPUPercent != nil || metrics.MemoryPercent != nil || metrics.DiskPercent != nil || metrics.UptimeSeconds != nil {
			t.Errorf("expected no fabricated data, got %+v", metrics)
		}
		if metrics.Message == "" {
			t.Error("expected an explanatory message when no host metrics are available")
		}
	})

	t.Run("non-200 returns unavailable state", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer ts.Close()

		metrics, err := telemetry.NewService(ts.URL, testLogger()).GetMetrics(ctx)
		if err != nil {
			t.Fatalf("expected unavailable state without error, got %v", err)
		}
		if metrics == nil || metrics.Available {
			t.Fatalf("expected Available=false, got %+v", metrics)
		}
	})
}

func assertFloat(t *testing.T, name string, got *float64, want float64) {
	t.Helper()
	if got == nil || *got != want {
		t.Errorf("expected %s %v, got %v", name, want, got)
	}
}

// logsServer serves body for the VictoriaLogs query endpoint and points the
// service's VictoriaLogs URL at it.
func logsServer(t *testing.T, status int, body string) telemetry.Service {
	t.Helper()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/select/logsql/query" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(ts.Close)
	t.Setenv("VICTORIALOGS_URL", ts.URL)
	return telemetry.NewService("http://unused-victoriametrics:8428", testLogger())
}

func TestTelemetryService_GetLogs(t *testing.T) {
	ctx := context.Background()

	t.Run("unreachable victorialogs reports an explicit unavailable state", func(t *testing.T) {
		t.Setenv("VICTORIALOGS_URL", "http://invalid-victorialogs-host:9999")
		svc := telemetry.NewService("http://unused-victoriametrics:8428", testLogger())

		resp, err := svc.GetLogs(ctx)
		if err != nil {
			t.Fatalf("expected unavailable state without error, got %v", err)
		}
		if resp.Available {
			t.Error("expected Available=false")
		}
		if resp.Reason != telemetry.LogsUnreachableReason {
			t.Errorf("expected reason %q, got %q", telemetry.LogsUnreachableReason, resp.Reason)
		}
		if resp.Logs == nil || len(resp.Logs) != 0 || resp.Total != 0 {
			t.Errorf("expected an empty non-nil log list, got %+v", resp)
		}
	})

	t.Run("non-200 from victorialogs is unreachable, not fabricated", func(t *testing.T) {
		resp, err := logsServer(t, http.StatusInternalServerError, "").GetLogs(ctx)
		if err != nil {
			t.Fatalf("expected unavailable state without error, got %v", err)
		}
		if resp.Available || resp.Reason != telemetry.LogsUnreachableReason || len(resp.Logs) != 0 {
			t.Errorf("expected unavailable/unreachable with no entries, got %+v", resp)
		}
	})

	t.Run("undecodable payload is unreachable", func(t *testing.T) {
		resp, err := logsServer(t, http.StatusOK, `{"_msg":"ok"}`+"\n"+`not json`).GetLogs(ctx)
		if err != nil {
			t.Fatalf("expected unavailable state without error, got %v", err)
		}
		if resp.Available || len(resp.Logs) != 0 {
			t.Errorf("expected unavailable with no entries, got %+v", resp)
		}
	})

	t.Run("empty store is available with no entries", func(t *testing.T) {
		resp, err := logsServer(t, http.StatusOK, "").GetLogs(ctx)
		if err != nil {
			t.Fatalf("expected success, got %v", err)
		}
		if !resp.Available || resp.Reason != "" {
			t.Errorf("expected available with no reason, got %+v", resp)
		}
		if resp.Logs == nil || len(resp.Logs) != 0 || resp.Total != 0 {
			t.Errorf("expected an empty non-nil log list, got %+v", resp)
		}
		data, err := json.Marshal(resp)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(string(data), `"logs":[]`) {
			t.Errorf("expected logs to serialize as an empty array, got %s", data)
		}
	})

	t.Run("real entries keep their stored timestamp and are returned oldest first", func(t *testing.T) {
		// VictoriaLogs answers newest first.
		body := `{"_msg":"second","_time":"2023-01-01T10:00:05.250Z","_stream_id":"s1","service_name":"auth-service","severity":"warn"}
{"message":"first","_time":"2023-01-01T10:00:01Z","_stream_id":"s1","service_name":"caddy","severity":"fatal"}
{"_msg":"third","_time":"2023-01-01T09:00:00Z","severity":"unknown"}`
		resp, err := logsServer(t, http.StatusOK, body).GetLogs(ctx)
		if err != nil {
			t.Fatalf("expected live logs success, got %v", err)
		}
		if !resp.Available || resp.Total != 3 || len(resp.Logs) != 3 {
			t.Fatalf("expected 3 available entries, got %+v", resp)
		}
		got := resp.Logs
		if got[0].Message != "third" || got[1].Message != "first" || got[2].Message != "second" {
			t.Fatalf("expected chronological order, got %q %q %q", got[0].Message, got[1].Message, got[2].Message)
		}
		if got[2].Timestamp != "10:00:05.250" || got[2].Service != "auth-service" || got[2].Level != "WARN" {
			t.Errorf("unexpected entry %+v", got[2])
		}
		if got[1].Level != "ERROR" || got[1].Service != "caddy" {
			t.Errorf("expected fatal to map to ERROR on caddy, got %+v", got[1])
		}
		if got[0].Level != "INFO" || got[0].Service != "system" {
			t.Errorf("expected defaults INFO/system, got %+v", got[0])
		}
		seen := map[string]bool{}
		for _, e := range got {
			if e.ID == "" || seen[e.ID] {
				t.Errorf("expected unique non-empty IDs, got %q", e.ID)
			}
			seen[e.ID] = true
		}
	})

	t.Run("entry IDs are stable across polls", func(t *testing.T) {
		body := `{"_msg":"hello","_time":"2023-01-01T00:00:00Z","_stream_id":"s1","service_name":"a"}`
		svc := logsServer(t, http.StatusOK, body)
		first, err := svc.GetLogs(ctx)
		if err != nil {
			t.Fatal(err)
		}
		second, err := svc.GetLogs(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if first.Logs[0].ID != second.Logs[0].ID {
			t.Errorf("expected a stable ID, got %q then %q", first.Logs[0].ID, second.Logs[0].ID)
		}
	})
}

func TestMetricsResponse_JSONOmitsUnsetFields(t *testing.T) {
	resp := &telemetry.MetricsResponse{Available: false, Message: "victoriametrics is unreachable"}
	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	for _, field := range []string{"cpu_percent", "memory_percent", "memory_used_gb", "memory_total_gb", "disk_percent", "disk_used_gb", "disk_total_gb", "uptime_seconds"} {
		if _, present := raw[field]; present {
			t.Errorf("expected field %q to be omitted when unset, got %v", field, raw[field])
		}
	}
	if raw["available"] != false {
		t.Errorf("expected available=false, got %v", raw["available"])
	}
}
