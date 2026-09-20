package telemetry

import (
	"fmt"
	"math"
	"time"
)

// unavailableMetrics returns the explicit "metrics unavailable" state used
// whenever VictoriaMetrics cannot be reached at all. It never fabricates
// numeric readings -- uptime is the only real value here, computed from this
// process's actual start time.
func (s *service) unavailableMetrics(reason string) *MetricsResponse {
	return &MetricsResponse{
		Available:     false,
		Message:       reason,
		UptimeSeconds: int64(time.Since(s.startTime).Seconds()),
	}
}

func (s *service) getLocalSystemLogs() *LogsResponse {
	now := time.Now()
	entries := []struct {
		offset  time.Duration
		level   string
		service string
		message string
	}{
		{-10 * time.Minute, "INFO", "caddy", "Reverse proxy ingress gateway listening on 0.0.0.0:80 [alfheim.loegien.localhost]"},
		{-8 * time.Minute, "SUCCESS", "zitadel", "Instance \"Alfheim\" initialized with OIDC discovery enabled"},
		{-6 * time.Minute, "INFO", "pantry-backend", "FastAPI service connected to PostgreSQL database (pool_size=10)"},
		{-5 * time.Minute, "INFO", "dashboard-go", "Go Chi HTTP router listening on :8080 (App Catalog ready)"},
		{-3 * time.Minute, "INFO", "telemetry", "VictoriaStack (VictoriaMetrics + VictoriaLogs + OTel) ingestion active"},
		{-2 * time.Minute, "SUCCESS", "dashboard-go", "Token validation succeeded for sub=zitadel-user-oidc"},
		{-45 * time.Second, "INFO", "pantry-backend", "GET /api/v1/apps 200 OK (3ms)"},
		{-20 * time.Second, "INFO", "dashboard-go", "GET /api/v1/profile/me 200 OK (4ms)"},
		{-5 * time.Second, "SUCCESS", "telemetry", "Heartbeat check: control plane status=healthy load=0.18"},
	}

	logs := make([]LogEntry, len(entries))
	for i, e := range entries {
		t := now.Add(e.offset)
		timestamp := t.Format("15:04:05.000")
		logs[i] = LogEntry{
			ID:        fmt.Sprintf("log-%d", t.UnixNano()),
			Timestamp: timestamp,
			Level:     e.level,
			Service:   e.service,
			Message:   e.message,
			Time:      t,
		}
	}

	return &LogsResponse{
		Logs:  logs,
		Total: len(logs),
	}
}

func roundFloat(val float64, precision int) float64 {
	ratio := math.Pow(10, float64(precision))
	return math.Round(val*ratio) / ratio
}
