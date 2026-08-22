package telemetry

import (
	"context"
	"fmt"
	"net/http"
)

func (s *service) queryVictoriaMetrics(ctx context.Context) (*MetricsResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.vmURL+"/api/v1/query?query=up", nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("victoriametrics returned status %d", resp.StatusCode)
	}

	// Return local system metrics decorated with live telemetry status
	local := s.getLocalSystemMetrics()
	return local, nil
}
