# AI Architectural Guidelines (`ai/`)

Welcome to the `loeger-os` AI Architectural Guidelines. This directory serves as the single source of truth for all AI coding assistants (e.g. Claude, Antigravity, Copilot) operating across any stack within this monorepo.

---

## 🚦 Instructions for AI Agents

When invoked on any task within the `loeger-os` repository, you **MUST** adhere to the following workflow:

1. **Read Universal Rules First**: Always read and strictly enforce [CORE.md](file:///Users/leifkroeger/Dev/loeger-os/ai/CORE.md). Its rules apply universally across all repositories, services, and languages.
2. **Select Stack Guide**: Locate and read the relevant technology stack guide inside [stacks/](file:///Users/leifkroeger/Dev/loeger-os/ai/stacks/) corresponding to the active service you are modifying:
   - 🐍 **Python / FastAPI**: [stacks/python-fastapi.md](file:///Users/leifkroeger/Dev/loeger-os/ai/stacks/python-fastapi.md)
   - ⚛️ **Next.js / Tailwind CSS**: [stacks/nextjs-tailwind.md](file:///Users/leifkroeger/Dev/loeger-os/ai/stacks/nextjs-tailwind.md)
   - 🐹 **Go**: [stacks/golang.md](file:///Users/leifkroeger/Dev/loeger-os/ai/stacks/golang.md)
   - ☕ **Java / Spring Boot**: [stacks/java-spring.md](file:///Users/leifkroeger/Dev/loeger-os/ai/stacks/java-spring.md)
3. **Template for New Stacks**: When adding support for a new framework or language, follow the standardized blueprint in [stacks/_template.md](file:///Users/leifkroeger/Dev/loeger-os/ai/stacks/_template.md).

---

## 📁 Directory Hierarchy

```text
ai/
├── README.md              # Entry point & AI agent directory map (this file)
├── CORE.md                # Repository-wide universal architectural standards
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
