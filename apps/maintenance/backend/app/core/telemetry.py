import json
import logging
import sys
from datetime import UTC, datetime

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, TELEMETRY_SDK_LANGUAGE, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import settings

# Global providers to allow graceful shutdown
_tracer_provider: TracerProvider | None = None


class JSONFormatter(logging.Formatter):
    """Custom logging Formatter that outputs log records as single-line JSON.

    Includes trace_id and span_id if an active tracing context exists.
    """

    def format(self, record: logging.LogRecord) -> str:
        span_context = trace.get_current_span().get_span_context()
        trace_id = format(span_context.trace_id, "032x") if span_context.is_valid else None
        span_id = format(span_context.span_id, "16x") if span_context.is_valid else None

        log_data = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "module": record.module,
            "filename": record.filename,
            "line_number": record.lineno,
        }

        if trace_id:
            log_data["trace_id"] = trace_id
        if span_id:
            log_data["span_id"] = span_id

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


def configure_logging() -> None:
    """Configures application logging to output structured JSON to stdout."""
    root_logger = logging.getLogger()
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO
    root_logger.setLevel(log_level)

    # Clean existing handlers to prevent duplicates
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    # Stdout JSON Handler
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(JSONFormatter())
    stdout_handler.setLevel(log_level)
    root_logger.addHandler(stdout_handler)

    # Configure Uvicorn loggers to propagate messages to the root logger
    for uvicorn_logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        uv_logger = logging.getLogger(uvicorn_logger_name)
        uv_logger.handlers = []
        uv_logger.propagate = True


def setup_telemetry(app: FastAPI) -> None:
    """Initialize OpenTelemetry Traces and Instrumentations."""
    global _tracer_provider

    # Create OTel resource attributes
    resource = Resource.create(
        attributes={
            SERVICE_NAME: settings.OTEL_SERVICE_NAME,
            TELEMETRY_SDK_LANGUAGE: "python",
            "environment": settings.ENVIRONMENT,
        }
    )

    # 1. Configure and apply standard logging
    configure_logging()

    # If OTel is not enabled, we stop setup here but keep structured JSON logging active
    if not settings.OTEL_ENABLED:
        logging.info("OpenTelemetry is disabled. Only structured JSON logging is enabled.")
        return

    logging.info(
        f"Initializing OpenTelemetry for service '{settings.OTEL_SERVICE_NAME}' "
        f"exporting to {settings.OTEL_EXPORTER_OTLP_ENDPOINT}"
    )

    try:
        # 2. Configure Tracing Provider & OTLP Exporter
        tracer_provider = TracerProvider(resource=resource)
        span_exporter = OTLPSpanExporter(
            endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT,
            insecure=settings.OTEL_EXPORTER_OTLP_INSECURE,
        )
        span_processor = BatchSpanProcessor(span_exporter)
        tracer_provider.add_span_processor(span_processor)
        trace.set_tracer_provider(tracer_provider)
        _tracer_provider = tracer_provider

        # 3. Instrument FastAPI
        FastAPIInstrumentor.instrument_app(app)

        logging.info("OpenTelemetry instrumentation completed successfully.")
    except Exception as e:
        logging.error(f"Error during OpenTelemetry setup: {e}", exc_info=True)


def shutdown_telemetry() -> None:
    """Gracefully flush and shutdown OpenTelemetry providers."""
    global _tracer_provider

    logging.info("Shutting down OpenTelemetry providers...")

    if _tracer_provider:
        try:
            _tracer_provider.shutdown()
            logging.info("TracerProvider shut down successfully.")
        except Exception as e:
            sys.stderr.write(f"Error shutting down TracerProvider: {e}\n")
