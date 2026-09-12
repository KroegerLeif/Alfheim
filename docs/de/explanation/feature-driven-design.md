---
title: "Feature-Driven Design (FDD)"
description: "Ausführliche Erläuterung des Feature-Driven-Design-Musters in den Python- und Go-Backends von Alfheim sowie der 200-LOC-Grenze für Next.js-Frontends."
---

> **Kurzfassung:** Ausführliche Erläuterung des Feature-Driven-Design-Musters in den Python- und Go-Backends von Alfheim sowie der 200-LOC-Grenze für Next.js-Frontends.

---

## 📋 Inhalt
- [Warum Feature-Driven Design?](#warum-feature-driven-design)
- [FDD-Verzeichnisstruktur im Backend](#fdd-verzeichnisstruktur-im-backend)
- [Explizite öffentliche Exporte (`__init__.py`)](#explizite-öffentliche-exporte-__init__py)
- [LOC-Grenze im Frontend (200 Zeilen)](#loc-grenze-im-frontend-200-zeilen)

---

## Warum Feature-Driven Design?

Klassische „Layer-First"-Architekturen legen alle Controller in einen Ordner, alle Datenbankmodelle in einen zweiten und alle Schemas in einen dritten. In einer wachsenden Codebasis erzeugt das hohe Reibung beim Refactoring und beim Hinzufügen neuer Fachlichkeit.

Alfheim setzt auf **Feature-Driven Design (FDD)**. Code ist um in sich geschlossene Fachfeatures herum organisiert (z. B. `locations`, `categories`, `products`, `inventory`). Jeder Feature-Ordner kapselt seine eigenen Modelle, Repositories, Services, Schemas, REST-Router, Unit-Tests und FastMCP-KI-Tools.

---

## FDD-Verzeichnisstruktur im Backend

Ein typisches Python-Backend-Feature unter `src/features/<feature>/` enthält:

```
src/features/inventory/
├── __init__.py             # Öffentliche Modulschnittstelle und explizite Exporte (__all__)
├── models.py               # SQLModel-/SQLAlchemy-Datenbankentitäten
├── schemas.py              # Pydantic-Request- & Response-Schemas
├── service.py              # Reine Fachlogik & transaktionale Operationen
├── router.py               # FastAPI-REST-Endpunkte
├── mcp_tools.py            # FastMCP-Tools, registriert am KI-Agenten-Hub
└── tests/                  # Unit- und Integrationstests direkt daneben
    ├── test_unit.py
    └── test_household_isolation.py
```

---

## Explizite öffentliche Exporte (`__init__.py`)

Für saubere Kapselung (Open-Closed-Prinzip) definiert jedes Feature-Verzeichnis seine öffentlichen Exporte explizit über `__all__`:

```python
# src/features/inventory/__init__.py
from .models import InventoryState, InventoryTransaction
from .service import InventoryService

__all__ = [
    "InventoryState",
    "InventoryTransaction",
    "InventoryService",
]
```

Private Hilfsfunktionen innerhalb von `service.py` oder `router.py` beginnen mit einem Unterstrich (`_calculate_batch_delta()`) und werden nicht aus dem Feature-Modul exportiert.

---

## LOC-Grenze im Frontend (200 Zeilen)

Um Wartbarkeit zu sichern, riesige React-Komponenten zu verhindern und Lesbarkeit zu garantieren, gilt für **alle Frontend-Quelldateien (`.ts` und `.tsx`) im gesamten Monorepo eine strikte Architekturgrenze von 200 Codezeilen (LOC)**.

* **Komponenten-Zerlegung:** Große Views werden in dedizierte Orchestratoren, Präsentationskomponenten, eigene TanStack-Query-Hooks und Typen aufgeteilt.
* **Wiederverwendung geteilter UI:** Microfrontends importieren geteilte Primitive (`Button`, `Badge`, `Dialog`, `Progress`, `Table`) und Layout-Wrapper (`AppHeader`) aus `@alfheim/shared`.
