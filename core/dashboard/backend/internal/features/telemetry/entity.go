// Package telemetry manages system health telemetry metrics and log streams.
package telemetry

import "time"

// MetricsResponse represents server health telemetry metrics.
type MetricsResponse struct {
	CPUPercent       float64 `json:"cpu_percent"`
	MemoryPercent    float64 `json:"memory_percent"`
	MemoryUsedGB     float64 `json:"memory_used_gb"`
	MemoryTotalGB    float64 `json:"memory_total_gb"`
	NetworkRxMbps    float64 `json:"network_rx_mbps"`
	NetworkTxMbps    float64 `json:"network_tx_mbps"`
	UptimeSeconds    int64   `json:"uptime_seconds"`
	ActiveContainers int     `json:"active_containers"`
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
