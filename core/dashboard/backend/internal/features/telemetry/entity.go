// Package telemetry manages system health telemetry metrics and log streams.
package telemetry

import "time"

// MetricsResponse represents server health telemetry metrics.
//
// Every numeric field is a pointer and is only populated when VictoriaMetrics
// actually returned data for it. This endpoint never fabricates a value to
// fill a gap: when Available is false, or when an individual field is nil,
// the caller must render an explicit "unavailable" state rather than assume
// a real reading of zero.
type MetricsResponse struct {
	// Available reports whether VictoriaMetrics was reachable at all. It says
	// nothing about whether every individual metric below has data -- a
	// reachable VictoriaMetrics with no host-level exporters configured will
	// still leave the numeric fields nil.
	Available        bool     `json:"available"`
	Message          string   `json:"message,omitempty"`
	CPUPercent       *float64 `json:"cpu_percent,omitempty"`
	MemoryPercent    *float64 `json:"memory_percent,omitempty"`
	MemoryUsedGB     *float64 `json:"memory_used_gb,omitempty"`
	MemoryTotalGB    *float64 `json:"memory_total_gb,omitempty"`
	NetworkRxMbps    *float64 `json:"network_rx_mbps,omitempty"`
	NetworkTxMbps    *float64 `json:"network_tx_mbps,omitempty"`
	UptimeSeconds    int64    `json:"uptime_seconds"`
	ActiveContainers *int     `json:"active_containers,omitempty"`
}

// LogEntry represents a single system log entry.
type LogEntry struct {
	ID        string    `json:"id"`
	Timestamp string    `json:"timestamp"`
	Level     string    `json:"level"` // "INFO" | "WARN" | "ERROR" | "SUCCESS"
	Service   string    `json:"service"`
	Message   string    `json:"message"`
	Time      time.Time `json:"-"`
}

// LogsResponse defines payload structure for GET /api/v1/telemetry/logs.
type LogsResponse struct {
	Logs  []LogEntry `json:"logs"`
	Total int        `json:"total"`
}
