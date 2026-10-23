package telemetry

import "math"

// unavailableMetrics returns the explicit "metrics unavailable" state used
// whenever VictoriaMetrics cannot be reached at all. It carries no numeric
// readings: every value on this endpoint must come from a real query.
func (s *service) unavailableMetrics(reason string) *MetricsResponse {
	return &MetricsResponse{
		Available: false,
		Message:   reason,
	}
}

func roundFloat(val float64, precision int) float64 {
	ratio := math.Pow(10, float64(precision))
	return math.Round(val*ratio) / ratio
}
