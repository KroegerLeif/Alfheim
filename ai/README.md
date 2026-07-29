# AI Architectural Guidelines (`ai/`)

Welcome to the `loeger-os` AI Architectural Guidelines. This directory serves as the single source of truth for all AI coding assistants (e.g. Claude, Antigravity, Copilot) operating across any stack within this monorepo.

---

## 🚦 Instructions for AI Agents

When invoked on any task within the `loeger-os` repository, you **MUST** adhere to the following workflow:

1. **Read Context First**: Always read [CONTEXT.md](./CONTEXT.md) **first**. It captures the current sprint state, DB schema invariants, feature flags, and completed commits so you can resume immediately without a full repo audit.
2. **Read Universal Rules**: Always read and strictly enforce [CORE.md](./CORE.md). Its rules apply universally across all repositories, services, and languages.
3. **Read Architecture**: Consult [ARCHITECTURE.md](./ARCHITECTURE.md) for the full service map, Docker network topology, Traefik routing table, and Keycloak JWT claim reference.
4. **Select Stack Guide**: Locate and read the relevant technology stack guide inside [stacks/](./stacks/) corresponding to the active service you are modifying:
   - 🐍 **Python / FastAPI**: [stacks/python-fastapi.md](./stacks/python-fastapi.md)
   - ⚛️ **Next.js / Tailwind CSS**: [stacks/nextjs-tailwind.md](./stacks/nextjs-tailwind.md)
   - 🐹 **Go**: [stacks/golang.md](./stacks/golang.md)
   - ☕ **Java / Spring Boot**: [stacks/java-spring.md](./stacks/java-spring.md)
5. **Template for New Stacks**: When adding support for a new framework or language, follow the standardized blueprint in [stacks/_template.md](./stacks/_template.md).

---

## 📁 Directory Hierarchy

```text
ai/
├── README.md              # Entry point & AI agent directory map (this file)
├── CORE.md                # Repository-wide universal architectural standards
├── ARCHITECTURE.md        # Monorepo layout, Docker services, Traefik routing, JWT claims
├── CONTEXT.md             # Sprint state, completed commits, DB invariants, feature flags
├── new-app-guideline.md   # Blueprint & checklist for creating new apps in apps/
└── stacks/                # Technology-specific architectural guidelines
    ├── _template.md       # Standardized blueprint for documentation of new stacks
    ├── python-fastapi.md  # Python FastAPI & FastMCP architectural guide
    ├── nextjs-tailwind.md # Next.js & Tailwind CSS v4 architectural guide
    ├── golang.md          # Go microservices architectural guide
    └── java-spring.md     # Java Spring Boot architectural guide
```

---

## 🎯 Architectural Philosophy

- **Feature-Driven Design (FDD)**: Group code by business domain capabilities, not technical roles.
- **Strict Decoupling**: Business logic resides strictly in reusable domain services.
- **Quality Verification**: Code must compile cleanly and be fully implemented—no empty files or dummy stubs.
- **Uncompromised Hygiene**: Clean English comments, strict type safety, and Conventional Commit standards.
