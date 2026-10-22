package telemetry

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
)

// PromQL queries against the node-exporter series that VictoriaMetrics scrapes
// (see infrastructure/telemetry/victoriametrics/scrape.yml). Each query
// legitimately returns an empty result vector until the first scrape has
// landed, and the corresponding MetricsResponse field is then left nil rather
// than being invented locally. Network throughput is deliberately absent:
// node-exporter runs in a bridge-networked container, so its netdev collector
// would report the container's own interface, not the host's.
const (
	// livenessQuery needs no stored series; it only proves VictoriaMetrics
	// answers queries.
	livenessQuery        = `vector(1)`
	cpuUsagePercentQuery = `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`
	memTotalBytesQuery   = `max(node_memory_MemTotal_bytes)`
	memAvailableBytes    = `max(node_memory_MemAvailable_bytes)`
	diskTotalBytesQuery  = `max(node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"})`
	diskAvailBytesQuery  = `max(node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"})`
	uptimeSecondsQuery   = `time() - max(node_boot_time_seconds)`
)

const bytesPerGB = 1024 * 1024 * 1024

type vmQueryResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string `json:"resultType"`
		Result     []struct {
			Value []interface{} `json:"value"`
		} `json:"result"`
	} `json:"data"`
}

// instantQuery executes a PromQL instant query against VictoriaMetrics.
// ok is false (with a nil error) when VictoriaMetrics answered successfully
// but has no data for the query -- the normal, honest "no exporter for this"
// case, distinct from a transport/HTTP failure.
func (s *service) instantQuery(ctx context.Context, promQL string) (value float64, ok bool, err error) {
	q := url.Values{}
	q.Set("query", promQL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.vmURL+"/api/v1/query?"+q.Encode(), nil)
	if err != nil {
		return 0, false, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, false, fmt.Errorf("victoriametrics returned status %d", resp.StatusCode)
	}

	var parsed vmQueryResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return 0, false, fmt.Errorf("failed to decode victoriametrics response: %w", err)
	}

	if parsed.Status != "success" || len(parsed.Data.Result) == 0 || len(parsed.Data.Result[0].Value) != 2 {
		return 0, false, nil
	}

	strVal, ok := parsed.Data.Result[0].Value[1].(string)
	if !ok {
		return 0, false, nil
	}

	val, err := strconv.ParseFloat(strVal, 64)
	if err != nil {
		return 0, false, nil
	}

	return val, true, nil
}

// queryVictoriaMetrics builds a MetricsResponse purely from real PromQL
// query results. It never falls back to fabricated or jittered values: any
// metric VictoriaMetrics has no data for is left nil, and the response is
// only returned as an error (triggering the caller's "unreachable" state)
// when VictoriaMetrics itself cannot be reached at all.
func (s *service) queryVictoriaMetrics(ctx context.Context) (*MetricsResponse, error) {
	// Liveness check: confirms VictoriaMetrics is reachable and answering
	// queries before trusting any of its data.
	if _, _, err := s.instantQuery(ctx, livenessQuery); err != nil {
		return nil, err
	}

	resp := &MetricsResponse{Available: true}

	if v, ok, _ := s.instantQuery(ctx, cpuUsagePercentQuery); ok {
		resp.CPUPercent = floatPtr(roundFloat(clamp(v, 0, 100), 1))
	}

	memTotal, memAvail := s.usage(ctx, memTotalBytesQuery, memAvailableBytes)
	if memTotal != nil {
		resp.MemoryTotalGB = floatPtr(roundFloat(*memTotal/bytesPerGB, 1))
	}
	if memTotal != nil && memAvail != nil && *memTotal > 0 {
		used := *memTotal - *memAvail
		resp.MemoryUsedGB = floatPtr(roundFloat(used/bytesPerGB, 1))
		resp.MemoryPercent = floatPtr(roundFloat(clamp(used / *memTotal * 100, 0, 100), 1))
	}

	diskTotal, diskAvail := s.usage(ctx, diskTotalBytesQuery, diskAvailBytesQuery)
	if diskTotal != nil {
		resp.DiskTotalGB = floatPtr(roundFloat(*diskTotal/bytesPerGB, 1))
	}
	if diskTotal != nil && diskAvail != nil && *diskTotal > 0 {
		used := *diskTotal - *diskAvail
		resp.DiskUsedGB = floatPtr(roundFloat(used/bytesPerGB, 1))
		resp.DiskPercent = floatPtr(roundFloat(clamp(used / *diskTotal * 100, 0, 100), 1))
	}

	if v, ok, _ := s.instantQuery(ctx, uptimeSecondsQuery); ok && v >= 0 {
		uptime := int64(v)
		resp.UptimeSeconds = &uptime
	}

	if resp.CPUPercent == nil && resp.MemoryPercent == nil && resp.DiskPercent == nil && resp.UptimeSeconds == nil {
		resp.Message = "victoriametrics is reachable but has no host-level metrics available yet"
	}

	return resp, nil
}

// usage runs a total/available query pair and returns whichever values
// VictoriaMetrics had data for (nil otherwise).
func (s *service) usage(ctx context.Context, totalQuery, availQuery string) (total, avail *float64) {
	if v, ok, _ := s.instantQuery(ctx, totalQuery); ok {
		total = &v
	}
	if v, ok, _ := s.instantQuery(ctx, availQuery); ok {
		avail = &v
	}
	return total, avail
}

func floatPtr(v float64) *float64 {
	return &v
}

func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
