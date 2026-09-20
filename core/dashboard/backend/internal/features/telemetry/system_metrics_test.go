package telemetry

import (
	"context"
	"io"
	"log/slog"
	"testing"
)

func TestRoundFloat(t *testing.T) {
	r := roundFloat(3.14159, 2)
	if r != 3.14 {
		t.Errorf("expected 3.14, got %f", r)
	}
}

func TestUnavailableMetrics(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	s := NewService("http://invalid-victoriametrics-host:9999", logger).(*service)

	metrics := s.unavailableMetrics("victoriametrics is unreachable")

	if metrics.Available {
		t.Error("expected Available to be false")
	}
	if metrics.Message != "victoriametrics is unreachable" {
		t.Errorf("expected message to be preserved, got %q", metrics.Message)
	}
	if metrics.CPUPercent != nil || metrics.MemoryPercent != nil || metrics.NetworkRxMbps != nil || metrics.NetworkTxMbps != nil || metrics.ActiveContainers != nil {
		t.Errorf("expected all numeric fields to be nil in the unavailable state, got %+v", metrics)
	}
	if metrics.UptimeSeconds < 0 {
		t.Errorf("expected non-negative uptime, got %d", metrics.UptimeSeconds)
	}
}

func TestNewService_EnvConfigurations(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	t.Run("VICTORIAMETRICS_URL and VICTORIALOGS_URL set", func(t *testing.T) {
		t.Setenv("VICTORIAMETRICS_URL", "http://vm-env:8428/")
		t.Setenv("VICTORIALOGS_URL", "http://vl-env:9428/")
		s := NewService("", logger).(*service)
		if s.vmURL != "http://vm-env:8428" {
			t.Errorf("expected http://vm-env:8428, got %s", s.vmURL)
		}
		if s.vlURL != "http://vl-env:9428" {
			t.Errorf("expected http://vl-env:9428, got %s", s.vlURL)
		}
	})

	t.Run("default fallback when all empty", func(t *testing.T) {
		t.Setenv("VICTORIAMETRICS_URL", "")
		t.Setenv("SIGNOZ_QUERY_SERVICE_URL", "")
		t.Setenv("VICTORIALOGS_URL", "")
		s := NewService("", logger).(*service)
		if s.vmURL != "http://victoriametrics:8428" {
			t.Errorf("expected default victoriametrics url, got %s", s.vmURL)
		}
	})

	t.Run("queryVictoriaLogs request error with invalid context", func(t *testing.T) {
		s := NewService("http://localhost:8428", logger).(*service)
		cancelledCtx, cancel := context.WithCancel(context.Background())
		cancel()
		_, err := s.queryVictoriaLogs(cancelledCtx)
		if err == nil {
			t.Fatal("expected error from cancelled ctx, got nil")
		}
	})
}
