package telemetry

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func (s *service) queryVictoriaLogs(ctx context.Context) (*LogsResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.vlURL+"/select/logsql/query?query=*&limit=30", nil)
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

	// Decode JSON line streams if returned
	var logs []LogEntry
	decoder := json.NewDecoder(resp.Body)
	for decoder.More() {
		var raw map[string]interface{}
		if err := decoder.Decode(&raw); err != nil {
			break
		}

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
		if severity == "" {
			severity = "INFO"
		}

		t := time.Now()
		logs = append(logs, LogEntry{
			ID:        fmt.Sprintf("vl-%d", len(logs)+1),
			Timestamp: t.Format("15:04:05.000"),
			Level:     strings.ToUpper(severity),
			Service:   serviceName,
			Message:   msg,
			Time:      t,
		})
	}

	if len(logs) == 0 {
		return nil, fmt.Errorf("no logs returned from victorialogs")
	}

	return &LogsResponse{
		Logs:  logs,
		Total: len(logs),
	}, nil
}
