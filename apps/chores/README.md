# Chores App — Why It Exists

> **This README answers WHY this application exists.** For implementation details, see [`backend/README.md`](./backend/README.md).

---

## 🎯 Purpose

The **Chores App** (`apps/chores`) is the household chore tracking and habit-building service for the Loeger-OS monorepo. It solves the problem of **household maintenance asymmetry and chore friction** — where cleaning, organizing, and daily house tasks are neglected, unassigned, or lead to arguments — with a structured, points-based gamified approach.

---

## 🎯 Core Value Proposition

| Problem | Solution |
| :--- | :--- |
| Chore ownership is ambiguous | Assignable daily chore instances with clear responsibility boundaries |
| Chores stack up when neglected | A `non_cumulative` reset engine that expires missed tasks nightly |
| Lack of incentive to clean | Points-based reward system with real-time feedback loops |
| Household consistency is hard to keep | Streak counters tracking consecutive days of full chore completion |
| Lack of completion audit history | Immutable completion history timeline tracking task executions |
| Intermittent task visibility | Dynamic status dashboards with real-time metric widgets |

---

## 🏗️ Architecture Overview

```
apps/chores/
├── backend/          # FastAPI service (chore templates, instances, streaks, reset scheduler, completion audit history)
└── compose.yml       # Service orchestration (backend, postgres, traefik rules)
```

The app follows the **Feature-Driven Design (FDD)** pattern defined in `.ai/rules/architecture.md`.

---

## 🔗 Integration Points

- **Keycloak OIDC**: JWT authentication. `household_id` claim scopes all chores and streaks to the active household.
- **Traefik**: Ingress at `/api/v1/chores` (backend).
- **FastMCP**: AI agent integration toolset for chat interfaces.

---

## 🔑 Key Concepts

- **Chore Template** (`chore_templates`): The blueprint config for a chore (name, instructions, points, recurrence properties).
- **Chore Instance** (`chore_instances`): A scheduled copy of a chore assigned to a specific day, tracking execution status.
- **Chore Completion History Audit** (`chore_completion_history`): Immutable audit timeline recording every instance completion event (timestamp, user, points awarded).
- **Household Streak** (`household_streaks`): Cumulative day counter incremented upon completing all scheduled chores by midnight.

