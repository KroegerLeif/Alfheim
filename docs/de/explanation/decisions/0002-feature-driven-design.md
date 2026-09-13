---
title: "ADR 0002: Feature-Driven Design & Bounded Context Monorepo"
description: "Technische Story: Microservice-Monorepo-Konsistenz & Feature-Modularisierung"
sidebar:
  label: "0002 Feature-Driven Design"
---

* Status: akzeptiert
* Deciders: Alfheim Core Architecture Team
* Datum: 2026-03-01

Technische Story: Microservice-Monorepo-Konsistenz & Feature-Modularisierung

---

## Kontext und Problembeschreibung

Das Erstellen eines skalierbaren Homelab-Monorepo mit mehreren Microservices (in Python FastAPI, Go und Next.js) erfordert strikte architektonische Grenzen, um monolithische Kopplung, Spaghetti-Importe und überdimensionierte Quelldateien zu verhindern.

---

## Entscheidungs-Treiber

* **Domain-Isolierung:** Stelle sicher, dass jede Feature-Domain (z.B. `inventory`, `products`, `locations` in Pantry) ihre eigenen Modelle, Services, Schemas und Router verwaltet.
* **Wartbarkeit & Lesbarkeit:** Verhindere riesige monolithische Controller- oder Component-Dateien.
* **Tenant-Sicherheit:** Erzwinge Multi-Tenancy-Isolierung (`X-Household-ID`) konsistent über alle Backend-Endpunkte und FastMCP-KI-Tools.

---

## Betrachtete Optionen

* **Option 1: Layer-First-Architektur** — Gruppiere Dateien nach Layer (`controllers/`, `models/`, `services/`) über die gesamte App.
* **Option 2: Feature-Driven Design (FDD) mit LOC-Limits** — Gruppiere Code nach in sich geschlossenen Domain-Features (`src/features/<domain>/`) mit strikten öffentlichen Modul-Exporten (`__init__.py`) und architektonischer Limit von 200 Codezeilen (LOC) pro Frontend-Datei.

---

## Entscheidungs-Ergebnis

Gewählte Option: **Option 2**, weil FDD perfekt mit Microservice-Bounded-Contexts abgestimmt ist, Feature-Entfernung oder -Hinzufügung trivial macht und LOC-Limits hochgradig Code-Lesbarkeit garantieren.

### Positive Konsequenzen

* **In sich geschlossene Features:** Feature-Unterverzeichnisse kapseln Datenbanktabellen, Geschäftslogik, REST-Router und FastMCP-Tools.
* **Strikte Frontend-Qualität:** 200-LOC-Limit verhindert aufgeblähte React-Komponenten und erzwingt Komposition in kleinere wiederverwendbare Hooks und Primitives.
* **Deterministische Tenant-Isolierung:** Alle Feature-Abfragen joinen Location- oder Household-Modelle, um Multi-Tenancy-Isolierung zu erzwingen.

### Negative Konsequenzen & Akzeptierte Kosten

* **Leichte Verzeichnis-Proliferation:** Das Erstellen von Domain-Unterordnern für kleinere Features fügt Ordner-Tiefe hinzu.
