---
title: "Budget & Treasury"
description: "Multi-tenant household financial management, account balance tracking, sinking fund pots, monthly envelope plans, and transaction ledger with receipt attachme"
---

> **TL;DR:** Multi-tenant household financial management, account balance tracking, sinking fund pots, monthly envelope plans, and transaction ledger with receipt attachment support.

Source: [`apps/budget/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/budget)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Fragmented household accounts | Centralized balance tracking (Checking, Savings, Cash, Credit) |
| Savings goal allocation | Virtual sinking fund pots with percentage/fixed target tracking |
| Unplanned expenses | Envelope-style monthly & event budget plans |
| Expense audit trail | Categorized transaction ledger with RustFS S3 receipt image attachments |

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Python 3.12 / FastAPI microservice with SQLModel (async SQLAlchemy), RustFS S3 integration, and OpenTelemetry.
- **Frontend:** Next.js 16 (App Router) microfrontend, Tailwind CSS v4, Lucide React, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_budget` database, owned by `budget_user`).

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Protocol & Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 16 Core Database Server |
| `budget-backend` | 8000 | `/budget/api/v1` | FastAPI REST API & Telemetry |
| `budget-frontend` | 3000 | `alfheim.loegien.localhost/budget` | Next.js Microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://budget_user:postgres@postgres-core:5432/alfheim_budget` | Async PostgreSQL connection string |
| `S3_ENDPOINT_URL` | `http://rustfs:9000` | S3-compatible object storage endpoint |
| `S3_BUCKET_NAME` | `budget-receipts` | S3 bucket for receipt images |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Base URL of the household membership API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generated secret)* | Shared secret sent as `Authorization: Bearer …` on membership checks. Required; the backend refuses to start without it |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1/budget` | Browser API base URL. Compose derives it from `ALFHEIM_BASE_URL` (build argument and runtime env) |

---

## 📁 Domain Features (`src/features/`)

- `accounts`: Bank, cash, and credit account management, balance tracking, and account types.
- `pots`: Virtual sinking funds and goal allocation pots with target progress tracking.
- `plans`: Envelope-based monthly and event-driven budget planning.
- `transactions`: Immutable ledger for income and expense transactions with receipt attachments.

---

## 🔌 MCP Tools

Served at `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`), authenticated the same way as
the REST API. Tools take no `household_id` parameter: they read `get_mcp_household_context()`.
The tools live in `src/mcp/` (`server.py` creates the FastMCP instance and registers
`get_budget_status`; `tools.py` registers the rest). `discover_and_import_mcp_tools()` also
imports any `mcp_tools.py` found under `src/features/`, but no budget feature ships one yet.

| Tool | Parameters | What it does |
| :--- | :--- | :--- |
| `get_budget_status` | none | Liveness probe. Returns a fixed message and does not read budget data |
| `get_pot_balances` | none | Lists the household's active pots with priority, current amount, target and overflow target |
| `suggest_budget_allocation` | `income` | Runs the priority cascade over the pots and reports the suggested allocation per pot, the unassigned buffer and the investment overflow. A dry run: it persists nothing |
| `analyze_spending_gap` | `month` (`YYYY-MM`) | Compares the total of the active plans with the expenses booked in that month and reports the gap, over or under budget, and the transaction count |
| `calculate_sinking_gap` | `pot_id` | Reports shortfall, remaining months, target and actual monthly rate, and the monthly gap for one sinking fund pot |

All five tools only read budget data; none of them creates or changes accounts, pots, plans or
transactions. A failure inside a tool is returned as an `Error …` string instead of an exception.

---

## 🏠 Household Scoping

Every route depends on `backend_shared.household.require_household` (any member role may read and
write). Budget's own forked `src/core/auth.py` claim-based auth was removed in favor of this
shared dependency; maintenance and shopping forward the caller's bearer token and
`X-Household-ID` when calling budget's API. See
[ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md).

---

## ⚠️ Known Issues & Open Follow-Ups

No known open issues beyond the general household-authorization items in
[Known Issues](../../explanation/known-issues.md).

---
