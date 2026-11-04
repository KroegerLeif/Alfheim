---
title: "Code Comment Conventions"
description: "How Alfheim code is documented: doc comment format per language, what comments say, TODO rules and which checks enforce them."
sidebar:
  label: "Code Comments"
---

> **TL;DR:** Comments explain why, public APIs get a doc comment in the language's standard format, and every `TODO` points to an issue. Ruff, `revive` and `verify.sh` enforce what a tool can check.

---

## Rules for every language

- A comment states **why** something is done, a constraint or a trade-off. It does not repeat what the code says.
- No commented-out code. Git keeps history.
- A marker for later work carries an issue number: `TODO(#123): drop this once the household API paginates`. A bare `TODO` or `FIXME` fails `./scripts/verify.sh --security`.
- When an agent finds work that should happen later, it opens an issue instead of leaving a comment.

## Go

Exported identifiers have a standard doc comment that starts with the identifier name:

```go
// Handler serves the conversations API.
type Handler struct{ /* ... */ }

// List returns the caller's conversations.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) { /* ... */ }
```

A comment on a `const` or `var` block covers every identifier in it. Enforced by the `revive` `exported` rule: `golangci-lint run --enable-only revive` in `./scripts/verify.sh --go` and in the `go-ci.yml` workflow. The shared configuration is the root `.golangci.yml`; `tools/installer` has its own. Stutter warnings (`contact.ContactCategory`) are switched off.

## Python

Public modules, classes, methods and functions have a Google-style docstring with a one-line summary, and `Args:`, `Returns:` and `Raises:` sections when they add information:

```python
async def list_items(session: AsyncSession, household_id: UUID) -> list[Item]:
    """Return the household's items, newest first.

    Args:
        session: Database session of the current request.
        household_id: Household confirmed by `require_household`.
    """
```

Enforced by ruff `D` rules with `convention = "google"` in `ruff.toml`. Tests, `conftest.py`, Alembic migrations and `scripts/` are exempt. Package (`D104`) and `__init__` (`D107`) docstrings are not required.

### Baseline

Files that predate the rule are listed in the "Docstring baseline" block of `ruff.toml`. New files are checked in full. Do not add entries; when you touch a baselined file, document it and delete its line.

## TypeScript

Exported hooks, API clients and shared components in `packages/shared` have a TSDoc block (`/** ... */`) with a summary and `@param` / `@returns` where the types do not explain the behavior. Page components need none. This rule is review-enforced; there is no linter for it yet.

## Where enforcement runs

| Check | Command | CI |
| --- | --- | --- |
| Python docstrings | `uv run ruff check .` (part of `./scripts/verify.sh --python`) | `python-ci.yml` |
| Go doc comments | `golangci-lint run --enable-only revive` (part of `./scripts/verify.sh --go`) | `go-ci.yml` |
| Bare `TODO` / `FIXME` | `./scripts/check-todo-refs.sh` (part of `./scripts/verify.sh --security`) | via `verify.sh` |
