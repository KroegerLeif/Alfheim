package telemetry_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"alfheim/dashboard/internal/features/telemetry"
	"alfheim/dashboard/internal/shared/middleware"
)

type mockTelemetryService struct {
	getMetricsFn func(ctx context.Context) (*telemetry.MetricsResponse, error)
	getLogsFn    func(ctx context.Context) (*telemetry.LogsResponse, error)
}

func (m *mockTelemetryService) GetMetrics(ctx context.Context) (*telemetry.MetricsResponse, error) {
	if m.getMetricsFn != nil {
		return m.getMetricsFn(ctx)
	}
	return &telemetry.MetricsResponse{}, nil
}

func (m *mockTelemetryService) GetLogs(ctx context.Context) (*telemetry.LogsResponse, error) {
	if m.getLogsFn != nil {
		return m.getLogsFn(ctx)
	}
	return &telemetry.LogsResponse{}, nil
}

func mockAuthMW(shouldAuth bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !shouldAuth {
				next.ServeHTTP(w, r)
				return
			}
			ctx := context.WithValue(r.Context(), middleware.UserContextKey, &middleware.UserClaims{Subject: "u1"})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func TestTelemetryHandler_GetMetrics(t *testing.T) {
	t.Run("returns 500 when service returns error", func(t *testing.T) {
		svc := &mockTelemetryService{
			getMetricsFn: func(ctx context.Context) (*telemetry.MetricsResponse, error) {
				return nil, errors.New("metrics error")
			},
		}
		h := telemetry.NewHandler(svc)
		r := chi.NewRouter()
		h.RegisterRoutes(r, mockAuthMW(true))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/telemetry/metrics", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status 500, got %d", rec.Code)
		}
	})

	t.Run("returns 200 OK with metrics response", func(t *testing.T) {
		svc := &mockTelemetryService{
			getMetricsFn: func(ctx context.Context) (*telemetry.MetricsResponse, error) {
				return &telemetry.MetricsResponse{CPUPercent: 12.5}, nil
			},
		}
		h := telemetry.NewHandler(svc)
		r := chi.NewRouter()
		h.RegisterRoutes(r, mockAuthMW(true))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/telemetry", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}
		var resp telemetry.MetricsResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode body: %v", err)
		}
		if resp.CPUPercent != 12.5 {
			t.Errorf("expected CPUPercent 12.5, got %f", resp.CPUPercent)
		}
	})
}

func TestTelemetryHandler_GetLogs(t *testing.T) {
	t.Run("returns 500 when service returns error", func(t *testing.T) {
		svc := &mockTelemetryService{
			getLogsFn: func(ctx context.Context) (*telemetry.LogsResponse, error) {
				return nil, errors.New("logs error")
			},
		}
		h := telemetry.NewHandler(svc)
		r := chi.NewRouter()
		h.RegisterRoutes(r, mockAuthMW(true))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/telemetry/logs", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status 500, got %d", rec.Code)
		}
	})

	t.Run("returns 200 OK with logs response", func(t *testing.T) {
		svc := &mockTelemetryService{
			getLogsFn: func(ctx context.Context) (*telemetry.LogsResponse, error) {
				return &telemetry.LogsResponse{Total: 1, Logs: []telemetry.LogEntry{{Message: "log msg"}}}, nil
			},
		}
		h := telemetry.NewHandler(svc)
		r := chi.NewRouter()
		h.RegisterRoutes(r, mockAuthMW(true))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/telemetry/logs", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}
	})
}
