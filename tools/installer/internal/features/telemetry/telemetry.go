// Package telemetry decides whether an installation runs the optional
// observability stack (OpenTelemetry collector, VictoriaMetrics,
// VictoriaLogs, Vector and Grafana). The switch is OTEL_ENABLED in .env:
// compose.prod.yaml passes it to every backend, and the installer reads it to
// decide whether Grafana's OIDC client and its Caddy route are provisioned.
package telemetry

import (
	"strconv"
	"strings"
)

// EnvKey is the .env variable that switches telemetry on or off.
const EnvKey = "OTEL_ENABLED"

// Enabled reports whether env (a parsed .env) turns telemetry on. A missing,
// empty or unparsable value means off, matching compose.prod.yaml's
// ${OTEL_ENABLED:-false} default, so a Lean Core install never provisions
// Grafana by accident.
func Enabled(env map[string]string) bool {
	on, err := strconv.ParseBool(strings.TrimSpace(env[EnvKey]))
	return err == nil && on
}

// EnvValue renders enabled the way .env stores it.
func EnvValue(enabled bool) string {
	return strconv.FormatBool(enabled)
}
