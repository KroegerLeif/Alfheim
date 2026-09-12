---
title: "Architekturüberblick"
description: "Architektonische Einordnung des Alfheim-Sovereign-OS-Monorepos: Control Plane, Container-Topologie und mehrzonige Netzwerkisolation."
---

> **Kurzfassung:** Architektonische Einordnung des Alfheim-Sovereign-OS-Monorepos: Control Plane, Container-Topologie und mehrzonige Netzwerkisolation.

---

## 📋 Inhalt
- [Architektur-Philosophie](#architektur-philosophie)
- [Monorepo-Aufbau & Workspace-Grenzen](#monorepo-aufbau--workspace-grenzen)
- [Control Plane vs. Microservices](#control-plane-vs-microservices)
- [Netzwerk-Topologie & Zonen-Segmentierung](#netzwerk-topologie--zonen-segmentierung)
- [Database-per-Service-Isolation](#database-per-service-isolation)

---

## Architektur-Philosophie

Alfheim ist als **selbstgehostetes, souveränes Haushalts-Betriebssystem** entworfen. Es verbindet die Modularität isolierter Microservices mit der Entwickler-Ergonomie eines einheitlichen Monorepos.

Tragende Säulen:
1. **Keine externen Cloud-Abhängigkeiten:** Identität, Datenbanken, Objektspeicher, Proxy und Telemetrie laufen vollständig lokal in Containern.
2. **Strikte mehrzonige Netzwerkisolation:** Dienste kommunizieren über segmentierte Docker-Bridge-Netzwerke, um den Schadensradius klein zu halten.
3. **Database per Service:** Jedes Backend besitzt eine isolierte Datenbank im gemeinsamen `postgres-core`-Cluster mit eigenem Least-Privilege-Eigentümer. Dienstübergreifende Datenbank-Joins sind strikt untersagt.
4. **Feature-Driven Design (FDD):** Fachlogik liegt in modularen Feature-Verzeichnissen (`src/features/<domain>`).

---

## Monorepo-Aufbau & Workspace-Grenzen

Die Codebasis ist in Ebenen-Verzeichnisse gegliedert:

```
alfheim/
├── core/                   # Control Plane der Plattform (Dashboard Backend/Frontend)
├── apps/                   # Fachliche Microservices (Pantry, Budget, Chores, Chat, Workout usw.)
├── infrastructure/         # Kerninfrastruktur (Caddy-Gateway, RustFS, VictoriaStack)
├── packages/               # Geteilte Monorepo-Pakete (@alfheim/shared, backend_shared)
├── deploy/                 # Server-Manifeste (stack-apps.yaml)
├── scripts/                # Orchestrierungsskripte (up.sh, verify.sh)
└── docs/                   # Zentrales Diátaxis-Dokumentationsportal
```

---

## Control Plane vs. Microservices

* **Core Control Plane (`core/dashboard`)**: Go (Backend) und Next.js (Frontend). Dient als zentraler Plattform-Launcher und zeigt registrierte Micro-Anwendungen, Systemstatus und den Haushalts-Umschalter.
* **Fachliche Microservices (`apps/*`)**: Eigenständige Module mit Fachdiensten (z. B. Vorratsverwaltung, Umschlag-Budgetierung, Trainingsdurchführung).

---

## Netzwerk-Topologie & Zonen-Segmentierung

Die Plattform erzwingt mehrzonige Isolation über dedizierte Docker-Bridge-Netzwerke:

* **`gateway-net`**: Verbindet das Caddy-Ingress-Gateway mit Frontends, Zitadel, RustFS S3 und den Backend-API-Endpunkten.
* **`infra-net`**: Isolierte Infrastruktur-Bridge zwischen Zitadel, `postgres-core` und den RustFS-S3-Backend-Ports.
* **`core-net`**: Dediziertes Control-Plane-Netz für `dashboard-backend` und `postgres-core`.
* **`app-<name>-net`**: App-isolierte Netze zwischen Microservice-Backends und `postgres-core` (z. B. `app-pantry-net`, `app-shopping-net`, `app-chat-net`).
* **`observability-internal`**: Telemetrie-Bridge zwischen App-Backends, Vector, OpenTelemetry Collector und VictoriaStack.

---

## Database-per-Service-Isolation

Um lose Kopplung zu garantieren und Datenvermischung zu verhindern, besitzt jeder Backend-Microservice eine isolierte Datenbank (`alfheim_<app>`) im gemeinsamen `postgres-core`-Cluster, die einem eigenen Nutzer (`<app>_user`) gehört. Die Isolation wird über Eigentum und Rechte erzwungen statt über getrennte Datenbankserver — das hält den Speicherbedarf auf Homelab-Hardware im Rahmen. Gemeinsamer Datenbankzustand zwischen Anwendungen ist ausdrücklich untersagt; Datenaustausch zwischen Diensten läuft über REST-API-Integration (etwa wenn Pantry knappe Bestände an Shopping übergibt).
