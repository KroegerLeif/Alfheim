# Java Spring Boot Architectural Guide (`.ai/stacks/java_spring.md`)

> **Note for AI Agents**: Always read [.ai/rules/core.md](file:///Users/leifkroeger/Dev/loeger-os/.ai/rules/core.md) first.

---

## 1. Overview & Stack Specifications

* **Language / Runtime**: Java 21+ (LTS)
* **Framework**: Spring Boot 3.x
* **Target Use Case**: Enterprise Microservices, Complex Domain Workflows

---

## 2. Feature Directory Architecture

Java microservices are structured by feature package under `com.loeger.os.<domain>`:

```text
src/main/java/com/loeger/os/
├── <domain>/                     # Feature domain package (e.g. pantry, shopping)
│   ├── model/                    # JPA Entities / Domain Records
│   │   └── ItemEntity.java
│   ├── dto/                      # Immutable DTO Records for Requests & Responses
│   │   ├── CreateItemRequest.java
│   │   └── ItemResponse.java
│   ├── service/                  # Service interfaces & Spring Service implementations
│   │   ├── ItemService.java
│   │   └── ItemServiceImpl.java
│   ├── controller/               # Spring REST Controllers (@RestController)
│   │   └── ItemController.java
│   ├── repository/               # Spring Data Repositories (@Repository)
│   │   └── ItemRepository.java
│   └── exception/                # Domain exceptions & local @ExceptionHandler
│       └── ItemNotFoundException.java
└── shared/                       # Domain-agnostic infrastructure (config, global filters)
```

---

## 3. Coding & Naming Conventions

* **Java 21 Records**: Use Java `record` types for all immutable DTOs and value objects.
* **Dependency Injection**: Use constructor injection (via `@RequiredArgsConstructor` or explicit constructors). Avoid `@Autowired` on fields.
* **Exception Handling**: Use custom domain exceptions mapped to standard HTTP response entities using `@ControllerAdvice` or `@ExceptionHandler`.
* **Validation**: Enforce DTO validation with `@Valid` and Jakarta Validation annotations (`@NotNull`, `@NotBlank`, `@Size`).

---

## 4. Service Layer & Decoupling Rules

* **Controllers**: Controllers (`@RestController`) are responsible solely for HTTP mapping, path variables, and validation. They delegate all processing to `@Service` interfaces.
* **Service Layer**: Business logic lives strictly in `@Service` implementation classes.

---

## 5. Quality Gate & Compilation Commands

Verify compilation and build execution before completing Java Spring tasks:

```bash
# Gradle build & compile verification
./gradlew compileJava

# Maven build & compile verification (if using Maven)
./mvnw compile
```
