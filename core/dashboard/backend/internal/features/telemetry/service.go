package telemetry

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

// Service defines operations for retrieving system telemetry and logs.
type Service interface {
	GetMetrics(ctx context.Context) (*MetricsResponse, error)
	GetLogs(ctx context.Context) (*LogsResponse, error)
}

type service struct {
	vmURL      string
	vlURL      string
	httpClient *http.Client
	log        *slog.Logger
	startTime  time.Time
}

// NewService creates a new telemetry service configured for VictoriaMetrics and VictoriaLogs.
func NewService(endpoint string, log *slog.Logger) Service {
	vmURL := os.Getenv("VICTORIAMETRICS_URL")
	if vmURL == "" {
		vmURL = endpoint
	}
	if vmURL == "" {
		vmURL = "http://victoriametrics:8428"
	}

	vlURL := os.Getenv("VICTORIALOGS_URL")
	if vlURL == "" {
		vlURL = "http://victorialogs:9428"
	}

	return &service{
		vmURL: strings.TrimRight(vmURL, "/"),
		vlURL: strings.TrimRight(vlURL, "/"),
		httpClient: &http.Client{
			Timeout: 3 * time.Second,
		},
		log:       log,
		startTime: time.Now(),
	}
}

func (s *service) GetMetrics(ctx context.Context) (*MetricsResponse, error) {
	// Attempt query to VictoriaMetrics Prometheus-compatible endpoint. This
	// never falls back to fabricated data -- when VictoriaMetrics cannot be
	// reached, the response explicitly reports metrics as unavailable.
	metrics, err := s.queryVictoriaMetrics(ctx)
	if err == nil && metrics != nil {
		return metrics, nil
	}

	logAttrs := []any{slog.String("vm_url", s.vmURL)}
	if err != nil {
		logAttrs = append(logAttrs, slog.String("error", err.Error()))
	}
	s.log.Debug("victoriametrics unreachable, returning explicit unavailable metrics state", logAttrs...)

	return s.unavailableMetrics("victoriametrics is unreachable"), nil
}

func (s *service) GetLogs(ctx context.Context) (*LogsResponse, error) {
	// Attempt query to VictoriaLogs LogSQL service
	logs, err := s.queryVictoriaLogs(ctx)
	if err == nil && logs != nil && len(logs.Logs) > 0 {
		return logs, nil
	}

	// Fallback to control plane system logs
	s.log.Debug("victoriastack log query endpoint unavailable, generating system logs fallback",
		slog.String("vl_url", s.vlURL),
	)
	return s.getLocalSystemLogs(), nil
}
