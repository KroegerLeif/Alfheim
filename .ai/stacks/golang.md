# Go Architectural Guide (`.ai/stacks/golang.md`)

> **Note for AI Agents**: Always read [.ai/rules/core.md](file:///Users/leifkroeger/Dev/alfheim/.ai/rules/core.md) first.

---

## 1. Overview & Stack Specifications

* **Language / Version**: Go 1.22+
* **Target Use Case**: High-Performance Microservices, Background Workers, and Infrastructure Services
* **Standard Library Priority**: Prefer standard library packages (`net/http`, `context`, `encoding/json`) or light idiomatic drivers.

---

## 2. Feature Directory Architecture

Go microservices within `alfheim` follow Feature-Driven Design isolated under `internal/features/`:

```text
cmd/
└── server/
    └── main.go           # Application entry point & dependency wireup
internal/
├── features/
│   └── <domain>/         # Encapsulated domain feature module
│       ├── entity.go     # Core domain structs and types
│       ├── dto.go        # Request / Response transfer objects & validation
│       ├── service.go    # Domain business logic interface & implementation
│       ├── handler.go    # HTTP / gRPC request handlers & router registration
│       ├── repository.go # Database access layer interface & implementation
│       └── errors.go     # Sentinel domain errors (e.g. ErrNotFound)
└── shared/               # Domain-agnostic utilities (logger, db connection, middleware)
```

---

## 3. Coding & Naming Conventions

* **File & Package Names**: Use lower_case or single-word package names (`package pantry`, `package shopping`).
* **Interfaces**: Define interfaces where they are consumed, not where they are implemented.
* **Explicit Error Handling**: Always check errors explicitly (`if err != nil`). Never ignore errors using `_` unless explicitly justified.
* **Context Passing**: Pass `ctx context.Context` as the first parameter of any function performing I/O or database queries.

---

## 4. Service Layer & Decoupling Rules

* **Handler Thinness**: HTTP handlers in `handler.go` parse JSON requests into DTOs, invoke methods on `service.go`, and serialize responses.
* **Service Purity**: `service.go` contains pure Go logic, depends on repository interfaces, and is agnostic of HTTP transport.

---

## 5. Quality Gate & Compilation Commands

Verify compilation and linting before completing any Go task:

```bash
# Verify compilation across all packages
go build ./...

# Run Go tests
go test ./...

# Run static analysis (if installed)
golangci-lint run
```
