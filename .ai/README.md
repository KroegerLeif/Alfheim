# AI Context & Standards Folder (`.ai/`)

Welcome to the `loeger-os` AI architectural configuration folder. This folder is structured to guide AI agents (e.g. Antigravity, Claude, Copilot) when they operate on this codebase, while ensuring human developers understand the governance standards.

---

## 👤 For Developers: How to use this folder

As a developer, you can leverage this folder to onboard AI tools or to understand the universal and stack-specific standards of the monorepo.

### 🤖 AI Agent Onboarding Prompt
When initiating a conversation with a new AI agent, you can prompt it with:
> "Please review the `.ai/INDEX.md` file to understand the architecture, standards, and workflows of this repository before making any edits."

### 📂 Directory Map
* **`README.md`**: This file (Human-focused monorepo guide & AI prompt instructions).
* **`INDEX.md`**: Agent router mapping what the AI should read and when.
* **`CONTEXT.md`**: Single source of truth for the AI's memory (Active Sprint, App Index, DB Invariants).
* **`rules/`**: Non-negotiable repository standards (core coding rules, architecture boundaries, and safety guards).
* **`workflows/`**: Operational checklists for auditing existing code and creating new services.
* **`blueprints/`**: Templates and guidelines for new apps, shared components, and themes.
* **`stacks/`**: Technology-specific architectural guides (Next.js, FastAPI, Go, Spring Boot).

---

## 🛠️ Developer Actions & AI Commit Rules

To maintain documentation hygiene automatically, AI agents must abide by the following:
1. **Separation of Concerns**: Human documentation goes into `README.md` files; machine state goes into `.ai/CONTEXT.md`.
2. **Auto-Maintenance**: Any code changes, feature additions, or service registrations must automatically update both the local app's `README.md` and `.ai/CONTEXT.md`.
3. **Split Commits**: All updates to files inside `.ai/` and other documentation files must be committed in a separate Conventional Commit (e.g., `docs(context): update CONTEXT.md and READMEs for <feature>`).
