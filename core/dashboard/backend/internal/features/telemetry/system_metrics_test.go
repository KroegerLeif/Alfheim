package telemetry

import (
	"context"
	"io"
	"log/slog"
	"os"
	"testing"
)

func TestGetSystemMemoryUsage_ProcMeminfo(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "meminfo")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpFile.Name())

	content := "MemTotal:       16384000 kB\nMemAvailable:    8192000 kB\n"
	if _, err := tmpFile.WriteString(content); err != nil {
		t.Fatal(err)
	}
	tmpFile.Close()

	orig := procMeminfoPath
	procMeminfoPath = tmpFile.Name()
	defer func() { procMeminfoPath = orig }()

	percent, used, total := getSystemMemoryUsage()
	if total <= 0 || used <= 0 || percent <= 0 {
		t.Errorf("expected positive meminfo metrics, got %v, %v, %v", percent, used, total)
	}
}

func TestGetSystemCPUUsage(t *testing.T) {
	for i := 0; i < 10; i++ {
		val := getSystemCPUUsage()
		if val < 4.0 || val > 95.0 {
			t.Errorf("expected cpu usage in [4.0, 95.0], got %f", val)
		}
	}
}

func TestRoundFloat(t *testing.T) {
	r := roundFloat(3.14159, 2)
	if r != 3.14 {
		t.Errorf("expected 3.14, got %f", r)
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

	t.Run("SIGNOZ_QUERY_SERVICE_URL fallback", func(t *testing.T) {
		t.Setenv("VICTORIAMETRICS_URL", "")
		t.Setenv("SIGNOZ_QUERY_SERVICE_URL", "http://signoz-env:8080/")
		t.Setenv("VICTORIALOGS_URL", "")
		s := NewService("", logger).(*service)
		if s.vmURL != "http://signoz-env:8080" {
			t.Errorf("expected http://signoz-env:8080, got %s", s.vmURL)
		}
		if s.vlURL != "http://victorialogs:9428" {
			t.Errorf("expected default victorialogs url, got %s", s.vlURL)
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
