// Package telemetry manages system health telemetry metrics and log streams.
package telemetry

import "time"

// MetricsResponse represents host health telemetry metrics.
//
// Every numeric field is a pointer and is only populated when VictoriaMetrics
// actually returned data for it. This endpoint never fabricates a value to
// fill a gap: when Available is false, or when an individual field is nil,
// the caller must render an explicit "unavailable" state rather than assume
// a real reading of zero.
type MetricsResponse struct {
	// Available reports whether VictoriaMetrics was reachable at all. It says
	// nothing about whether every individual metric below has data -- a
	// reachable VictoriaMetrics whose node-exporter scrape has not delivered
	// samples yet will still leave the numeric fields nil.
	Available     bool     `json:"available"`
	Message       string   `json:"message,omitempty"`
	CPUPercent    *float64 `json:"cpu_percent,omitempty"`
	MemoryPercent *float64 `json:"memory_percent,omitempty"`
	MemoryUsedGB  *float64 `json:"memory_used_gb,omitempty"`
	MemoryTotalGB *float64 `json:"memory_total_gb,omitempty"`
	// Disk figures describe the host's root filesystem.
	DiskPercent *float64 `json:"disk_percent,omitempty"`
	DiskUsedGB  *float64 `json:"disk_used_gb,omitempty"`
	DiskTotalGB *float64 `json:"disk_total_gb,omitempty"`
	// UptimeSeconds is the host's uptime, derived from node_boot_time_seconds.
	UptimeSeconds *int64 `json:"uptime_seconds,omitempty"`
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

// LogsUnreachableReason is the LogsResponse.Reason reported when VictoriaLogs
// cannot be queried at all.
const LogsUnreachableReason = "unreachable"

// LogsResponse defines payload structure for GET /api/v1/telemetry/logs.
//
// The endpoint never fabricates entries. Available=false (with a Reason)
// means VictoriaLogs could not be queried; Available=true with an empty Logs
// slice means it answered and simply holds no entries yet. Logs is always a
// non-nil slice so clients can rely on an array.
type LogsResponse struct {
	Available bool       `json:"available"`
	Reason    string     `json:"reason,omitempty"`
	Logs      []LogEntry `json:"logs"`
	Total     int        `json:"total"`
}
