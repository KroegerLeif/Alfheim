package logger

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"testing"

	"go.opentelemetry.io/otel/trace"
)

func TestInit_Development(t *testing.T) {
	log := Init("development")
	if log == nil {
		t.Fatal("expected non-nil logger in development environment")
	}

	ctx := context.Background()
	if !log.Enabled(ctx, slog.LevelDebug) {
		t.Errorf("expected debug level logging to be enabled in development environment")
	}
}

func TestInit_Production(t *testing.T) {
	log := Init("production")
	if log == nil {
		t.Fatal("expected non-nil logger in production environment")
	}

	ctx := context.Background()
	if !log.Enabled(ctx, slog.LevelInfo) {
		t.Errorf("expected info level logging to be enabled in production environment")
	}
	if log.Enabled(ctx, slog.LevelDebug) {
		t.Errorf("expected debug level logging to be disabled in production environment")
	}
}

func TestTraceHandler_AppendsTraceAndSpanID(t *testing.T) {
	var buf bytes.Buffer
	baseHandler := slog.NewJSONHandler(&buf, nil)
	handler := &traceHandler{Handler: baseHandler}
	logger := slog.New(handler)

	traceIDStr := "4bf92f3577b34da6a3ce929d0e0e4736"
	spanIDStr := "00f067aa0ba902b7"

	traceID, err := trace.TraceIDFromHex(traceIDStr)
	if err != nil {
		t.Fatalf("failed to parse trace ID hex: %v", err)
	}
	spanID, err := trace.SpanIDFromHex(spanIDStr)
	if err != nil {
		t.Fatalf("failed to parse span ID hex: %v", err)
	}

	sc := trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    traceID,
		SpanID:     spanID,
		TraceFlags: trace.FlagsSampled,
	})

	ctx := trace.ContextWithSpanContext(context.Background(), sc)
	logger.InfoContext(ctx, "test trace context logging")

	var result map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("failed to unmarshal JSON output: %v", err)
	}

	if got, want := result["trace_id"], traceIDStr; got != want {
		t.Errorf("expected trace_id %q, got %q", want, got)
	}
	if got, want := result["span_id"], spanIDStr; got != want {
		t.Errorf("expected span_id %q, got %q", want, got)
	}
}

func TestTraceHandler_NoSpanContext(t *testing.T) {
	var buf bytes.Buffer
	baseHandler := slog.NewJSONHandler(&buf, nil)
	handler := &traceHandler{Handler: baseHandler}
	logger := slog.New(handler)

	logger.InfoContext(context.Background(), "test no trace context")

	var result map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("failed to unmarshal JSON output: %v", err)
	}

	if _, ok := result["trace_id"]; ok {
		t.Errorf("unexpected trace_id in log record when no span context present")
	}
	if _, ok := result["span_id"]; ok {
		t.Errorf("unexpected span_id in log record when no span context present")
	}
}
