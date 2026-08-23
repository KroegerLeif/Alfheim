import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI
from opentelemetry import metrics, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import SERVICE_NAME, TELEMETRY_SDK_LANGUAGE, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

# Global providers to allow graceful shutdown
_tracer_provider: TracerProvider | None = None
_meter_provider: MeterProvider | None = None
_logger_provider: LoggerProvider | None = None


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


def configure_logging(resource: Resource | None = None, settings: Any = None) -> LoggerProvider | None:
    """Configures application logging.

    Outputs structured JSON to stdout and routes records to OTel Collector via OTLP/gRPC if enabled.
    """
    root_logger = logging.getLogger()
    debug_flag = getattr(settings, "DEBUG", True) if settings else True
    log_level = logging.DEBUG if debug_flag else logging.INFO
    root_logger.setLevel(log_level)

    # Clean existing handlers to prevent duplicates
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    # 1. Stdout JSON Handler
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(JSONFormatter())
    stdout_handler.setLevel(log_level)
    root_logger.addHandler(stdout_handler)

    # Configure Uvicorn loggers to propagate messages to the root logger
    for uvicorn_logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        uv_logger = logging.getLogger(uvicorn_logger_name)
        uv_logger.handlers = []
        uv_logger.propagate = True

    # 2. OTel OTLP gRPC Logging Handler (if enabled)
    otel_enabled = getattr(settings, "OTEL_ENABLED", False) if settings else False
    if otel_enabled and resource:
        try:
            logger_provider = LoggerProvider(resource=resource)
            set_logger_provider(logger_provider)

            endpoint = getattr(settings, "OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
            insecure = getattr(settings, "OTEL_EXPORTER_OTLP_INSECURE", True)

            log_exporter = OTLPLogExporter(
                endpoint=endpoint,
                insecure=insecure,
            )
            logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))

            otel_handler = LoggingHandler(level=log_level, logger_provider=logger_provider)
            root_logger.addHandler(otel_handler)

            return logger_provider
        except Exception as e:
            sys.stderr.write(f"Failed to initialize OpenTelemetry log exporter: {e}\n")

    return None


def setup_telemetry(app: FastAPI, settings: Any = None, engine: Any = None) -> None:
    """Initialize OpenTelemetry (Traces, Metrics, Logs) and Instrumentations."""
    global _tracer_provider, _meter_provider, _logger_provider

    service_name = getattr(settings, "OTEL_SERVICE_NAME", "backend-service") if settings else "backend-service"
    environment = getattr(settings, "ENVIRONMENT", "development") if settings else "development"
    otel_enabled = getattr(settings, "OTEL_ENABLED", False) if settings else False
    endpoint = (
        getattr(settings, "OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
        if settings
        else "http://localhost:4317"
    )
    insecure = getattr(settings, "OTEL_EXPORTER_OTLP_INSECURE", True) if settings else True

    # Create OTel resource attributes
    resource = Resource.create(
        attributes={
            SERVICE_NAME: service_name,
            TELEMETRY_SDK_LANGUAGE: "python",
            "environment": environment,
        }
    )

    # 1. Configure and apply standard logging
    _logger_provider = configure_logging(resource=resource, settings=settings)

    # If OTel is not enabled, we stop setup here but keep structured JSON logging active
    if not otel_enabled:
        logging.info("OpenTelemetry is disabled. Only structured JSON logging is enabled.")
        return

    logging.info(f"Initializing OpenTelemetry for service '{service_name}' exporting to {endpoint}")

    try:
        # 2. Configure Tracing Provider & OTLP Exporter
        tracer_provider = TracerProvider(resource=resource)
        span_exporter = OTLPSpanExporter(
            endpoint=endpoint,
            insecure=insecure,
        )
        span_processor = BatchSpanProcessor(span_exporter)
        tracer_provider.add_span_processor(span_processor)
        trace.set_tracer_provider(tracer_provider)
        _tracer_provider = tracer_provider

        # 3. Configure Metrics Provider & OTLP Exporter
        try:
            metric_exporter = OTLPMetricExporter(
                endpoint=endpoint,
                insecure=insecure,
            )
            metric_reader = PeriodicExportingMetricReader(metric_exporter)
            meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
            metrics.set_meter_provider(meter_provider)
            _meter_provider = meter_provider
        except Exception as metric_err:
            logging.warning("Failed to initialize OpenTelemetry metrics exporter: %s", metric_err)

        # 4. Instrument Libraries
        # FastAPI
        FastAPIInstrumentor.instrument_app(app)

        # SQLAlchemy / SQLModel database queries (if engine is provided)
        if engine is not None:
            sync_engine = getattr(engine, "sync_engine", engine)
            SQLAlchemyInstrumentor().instrument(engine=sync_engine)

        # Inject Trace Context into standard logs
        try:
            LoggingInstrumentor().instrument()
        except Exception as log_inst_err:
            logging.warning("LoggingInstrumentor initialization skipped: %s", log_inst_err)

        logging.info("OpenTelemetry instrumentation completed successfully.")
    except Exception as e:
        logging.error(f"Error during OpenTelemetry setup: {e}", exc_info=True)


def shutdown_telemetry() -> None:
    """Gracefully flush and shutdown OpenTelemetry providers."""
    global _tracer_provider, _meter_provider, _logger_provider

    logging.info("Shutting down OpenTelemetry providers...")

    if _tracer_provider:
        try:
            _tracer_provider.shutdown()
            logging.info("TracerProvider shut down successfully.")
        except Exception as e:
            sys.stderr.write(f"Error shutting down TracerProvider: {e}\n")

    if _meter_provider:
        try:
            _meter_provider.shutdown()
            logging.info("MeterProvider shut down successfully.")
        except Exception as e:
            sys.stderr.write(f"Error shutting down MeterProvider: {e}\n")

    if _logger_provider:
        try:
            _logger_provider.shutdown()
            logging.info("LoggerProvider shut down successfully.")
        except Exception as e:
            sys.stderr.write(f"Error shutting down LoggerProvider: {e}\n")
