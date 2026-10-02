package telemetry

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// PromQL queries for standard node-exporter-style metrics. These are real
// queries against VictoriaMetrics -- when the configured VictoriaMetrics
// instance has no host-level exporter feeding it (the common case for this
// stack today, which only ingests OTel application metrics), each query
// legitimately returns an empty result vector and the corresponding
// MetricsResponse field is left nil rather than being invented locally.
const (
	cpuUsagePercentQuery  = `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`
	memTotalBytesQuery    = `node_memory_MemTotal_bytes`
	memAvailableBytes     = `node_memory_MemAvailable_bytes`
	netRxBytesPerSecQuery = `sum(rate(node_network_receive_bytes_total{device!="lo"}[5m]))`
	netTxBytesPerSecQuery = `sum(rate(node_network_transmit_bytes_total{device!="lo"}[5m]))`
	activeTargetsQuery    = `count(up == 1)`
)

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
	if _, _, err := s.instantQuery(ctx, activeTargetsQuery); err != nil {
		return nil, err
	}

	resp := &MetricsResponse{
		Available:     true,
		UptimeSeconds: int64(time.Since(s.startTime).Seconds()),
	}

	if v, ok, _ := s.instantQuery(ctx, cpuUsagePercentQuery); ok {
		resp.CPUPercent = floatPtr(roundFloat(clamp(v, 0, 100), 1))
	}

	var memTotalGB *float64
	if v, ok, _ := s.instantQuery(ctx, memTotalBytesQuery); ok {
		gb := roundFloat(v/1024/1024/1024, 1)
		memTotalGB = &gb
		resp.MemoryTotalGB = memTotalGB
	}
	if v, ok, _ := s.instantQuery(ctx, memAvailableBytes); ok && memTotalGB != nil {
		availGB := v / 1024 / 1024 / 1024
		usedGB := roundFloat(*memTotalGB-availGB, 1)
		resp.MemoryUsedGB = floatPtr(usedGB)
		if *memTotalGB > 0 {
			resp.MemoryPercent = floatPtr(roundFloat(clamp(usedGB/(*memTotalGB)*100, 0, 100), 1))
		}
	}

	if v, ok, _ := s.instantQuery(ctx, netRxBytesPerSecQuery); ok {
		resp.NetworkRxMbps = floatPtr(roundFloat(v*8/1_000_000, 1))
	}
	if v, ok, _ := s.instantQuery(ctx, netTxBytesPerSecQuery); ok {
		resp.NetworkTxMbps = floatPtr(roundFloat(v*8/1_000_000, 1))
	}
	if v, ok, _ := s.instantQuery(ctx, activeTargetsQuery); ok {
		n := int(v)
		resp.ActiveContainers = &n
	}

	if resp.CPUPercent == nil && resp.MemoryPercent == nil && resp.NetworkRxMbps == nil && resp.NetworkTxMbps == nil {
		resp.Message = "victoriametrics is reachable but has no host-level metrics available yet"
	}

	return resp, nil
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
