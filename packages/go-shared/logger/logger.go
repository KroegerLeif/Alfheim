// Package logger provides structured JSON logging using Go's standard log/slog package.
package logger

import (
	"context"
	"log/slog"
	"os"
	"strings"

	"go.opentelemetry.io/otel/trace"
)

// traceHandler wraps an existing slog.Handler to inject OpenTelemetry trace_id and span_id
// into JSON log records when active span context is present in the context.Context.
type traceHandler struct {
	slog.Handler
}

// Handle extracts trace_id and span_id from ctx and adds them as slog attributes if present.
func (h *traceHandler) Handle(ctx context.Context, r slog.Record) error {
	if ctx != nil {
		spanCtx := trace.SpanContextFromContext(ctx)
		if spanCtx.IsValid() {
			r.AddAttrs(
				slog.String("trace_id", spanCtx.TraceID().String()),
				slog.String("span_id", spanCtx.SpanID().String()),
			)
		}
	}
	return h.Handler.Handle(ctx, r)
}

// WithAttrs returns a new traceHandler with the given attributes added.
func (h *traceHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &traceHandler{
		Handler: h.Handler.WithAttrs(attrs),
	}
}

// WithGroup returns a new traceHandler with the given group name added.
func (h *traceHandler) WithGroup(name string) slog.Handler {
	return &traceHandler{
		Handler: h.Handler.WithGroup(name),
	}
}

// Init initializes the global slog logger based on the environment configuration.
func Init(environment string) *slog.Logger {
	opts := &slog.HandlerOptions{
		AddSource: strings.ToLower(environment) == "development",
		Level:     slog.LevelInfo,
	}

	if strings.ToLower(environment) == "development" {
		opts.Level = slog.LevelDebug
	}

	baseHandler := slog.NewJSONHandler(os.Stdout, opts)
	handler := &traceHandler{Handler: baseHandler}
	log := slog.New(handler)
	slog.SetDefault(log)

	return log
}
