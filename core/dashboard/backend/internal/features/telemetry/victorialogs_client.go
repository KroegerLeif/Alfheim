package telemetry

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"
)

// logsQuery returns the newest entries, so the dashboard shows what just
// happened rather than an arbitrary sample of the retention window.
const (
	logsQuery = `* | sort by (_time) desc`
	logsLimit = "30"
)

// queryVictoriaLogs fetches the newest log entries from VictoriaLogs. It
// returns an error only when VictoriaLogs cannot be queried (transport
// failure, non-200 status, undecodable payload); an empty store yields an
// available response with no entries. Entry timestamps and IDs come from the
// stored records, so the same entry keeps the same ID across polls.
func (s *service) queryVictoriaLogs(ctx context.Context) (*LogsResponse, error) {
	q := url.Values{}
	q.Set("query", logsQuery)
	q.Set("limit", logsLimit)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.vlURL+"/select/logsql/query?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("victorialogs returned status %d", resp.StatusCode)
	}

	// VictoriaLogs streams one JSON object per line.
	logs := []LogEntry{}
	decoder := json.NewDecoder(resp.Body)
	for decoder.More() {
		var raw map[string]interface{}
		if err := decoder.Decode(&raw); err != nil {
			return nil, fmt.Errorf("failed to decode victorialogs response: %w", err)
		}
		logs = append(logs, logEntryFromRecord(raw))
	}

	// Newest-first from the query; the feed renders oldest-first.
	slices.SortStableFunc(logs, func(a, b LogEntry) int { return a.Time.Compare(b.Time) })

	return &LogsResponse{
		Available: true,
		Logs:      logs,
		Total:     len(logs),
	}, nil
}

// logEntryFromRecord maps one stored VictoriaLogs record to a LogEntry.
func logEntryFromRecord(raw map[string]interface{}) LogEntry {
	msg, _ := raw["_msg"].(string)
	if msg == "" {
		msg, _ = raw["message"].(string)
	}
	if msg == "" {
		msg = fmt.Sprintf("%v", raw)
	}

	serviceName, _ := raw["service_name"].(string)
	if serviceName == "" {
		serviceName = "system"
	}

	severity, _ := raw["severity"].(string)

	// The record's own timestamp. A record without a parseable _time keeps a
	// zero time rather than being stamped with "now".
	var t time.Time
	timeField, _ := raw["_time"].(string)
	if parsed, err := time.Parse(time.RFC3339Nano, timeField); err == nil {
		t = parsed
	}
	timestamp := ""
	if !t.IsZero() {
		timestamp = t.Format("15:04:05.000")
	}

	stream, _ := raw["_stream_id"].(string)
	h := fnv.New64a()
	_, _ = fmt.Fprintf(h, "%s|%s|%s|%s", stream, timeField, serviceName, msg)

	return LogEntry{
		ID:        fmt.Sprintf("vl-%x", h.Sum64()),
		Timestamp: timestamp,
		Level:     normalizeSeverity(severity),
		Service:   serviceName,
		Message:   msg,
		Time:      t,
	}
}

// normalizeSeverity maps the severities Vector writes (and common aliases)
// onto the levels the dashboard renders.
func normalizeSeverity(severity string) string {
	switch strings.ToUpper(strings.TrimSpace(severity)) {
	case "WARN", "WARNING":
		return "WARN"
	case "ERROR", "ERR", "FATAL", "CRIT", "CRITICAL":
		return "ERROR"
	case "SUCCESS", "OK":
		return "SUCCESS"
	default:
		return "INFO"
	}
}
