---
title: "ADR 0003: Migration von Keycloak zu Zitadel"
description: "Technische Story: Identity Provider RAM-Optimierung & Startup-Beschleunigung"
sidebar:
  label: "0003 Zitadel-Migration"
---

* Status: akzeptiert
* Deciders: Alfheim Core Architecture Team
* Datum: 2026-03-01

Technische Story: Identity Provider RAM-Optimierung & Startup-Beschleunigung

---

## Kontext und Problembeschreibung

Alfheim nutzte zuvor Keycloak als seinen zentralisierten Identity and Access Management (IAM) Provider. Das Betreiben von Keycloak auf Java/JVM verursacht einen hohen Speicher-Fußabdruck (~1 GB RAM) und erweiterte Cold-Start-Boot-Zeiten aufgrund von Liquibase-Datenbank-Migrationen. Auf eingeschränkter Homelab-Hardware (wie Single-Board-Computer und Mini-PCs) begrenzt dieser hohe Speicherverbrauch verfügbare Ressourcen für Anwendungs-Microservices und führt zu Startup-Ordering-Verzögerungen.

Weil Alfheim pre-v1.0 mit null Live-Produktions-Benutzer oder Legacy-Identitäts-Datenbank-Migrationen ist, trägt die Migration zu einer leichteren IAM-Lösung keine Backward-Compatibility-Last.

---

## Entscheidungs-Treiber

* **Ressourcen-Fußabdruck:** Reduziere RAM-Verbrauch auf Homelab-Hardware erheblich.
* **Boot-Zeit & Healthchecks:** Erreiche schnelle Container-Boot-Zeiten und instant Healthchecks für zuverlässiges Stack-Bring-Up (`scripts/up.sh`).
* **Architektonische Trennung:** Nutze Zitadel strikt für globale Benutzer-Authentifizierung (AuthN) und Identität, während die Beibehaltung von Haushalt-Mitgliedschaften und Multi-Tenant-Autorisierung (AuthZ) in Alfheim Core/Dashboard.
* **Standardisiertes OIDC:** Standardisiere auf standardisiert generischer OIDC Authorization Code Flow mit PKCE, eliminierend benutzerdefinierte Identity Provider Themes und JAR-Kompilation.

---

## Betrachtete Optionen

* **Option 1: Behalte Keycloak 26** — Behalte Java-basierte Keycloak und versuche JVM-Speicher-Tuning.
* **Option 2: Migration zu Zitadel** — Ersetze Keycloak vollständig durch Zitadel, einen leichtgewichtigen Go-basierten OIDC-Identity-Provider.
* **Option 3: In-House Custom Auth Server** — Implementiere Custom OAuth2/OIDC-Handling in Alfheim Core.

---

## Entscheidungs-Ergebnis

Gewählte Option: **Option 2 (Migration zu Zitadel)**, weil Zitadel weniger als 150 MB RAM erfordert, Sub-Sekunden-Container-Healthchecks bietet und sauber Identitätsverwaltung isoliert, während Alfheim Core Haushalt-Level-Autorisierung handhaben kann.

### Positive Konsequenzen

* **Substantielle RAM-Einsparungen:** Senke Identitäts-Service-Speicher-Fußabdruck von ~1 GB zu <150 MB RAM.
* **Rasanter Stack-Bring-Up:** Instant Container-Health-Checks lösen Cold-Start-Ordering-Race-Conditions.
* **Saubere Build-Pipeline:** Eliminiere Custom-Keycloak-Theme-Kompilation (`alfheim-theme.jar`) und Keycloakify-Workspace-Dependencies.
* **Generisches OIDC-Standardisierung:** Anwendungen verbrauchen standardisiertes OIDC-PKCE-Parameter (`OIDC_ISSUER_URL`, `OIDC_AUDIENCE`).

### Negative Konsequenzen & Akzeptierte Kosten

* **Konfiguration-Updates:** Erfordert Aktualisierung von Infrastruktur-Manifests, Umgebungsvariablen-Spezifikationen (`OIDC_*` und `ZITADEL_*`) und Dokumentation.

---

## Pros und Cons der Optionen

### Option 1: Behalte Keycloak 26

* Gut, weil Keycloak eine Merkmals-reiche, Enterprise-bewährte IAM-Lösung ist.
* Schlecht, weil ~1 GB RAM-Overhead für Homelab-Umgebungen übermäßig ist.
* Schlecht, weil langsame Container-Startup-Zeiten Verzögerungen während Stack-Bring-Up verursachen.

### Option 2: Migration zu Zitadel

* Gut, weil Go-Binär-Ausführung <150 MB RAM-Fußabdruck erreicht.
* Gut, weil Sub-Sekunden-Startup-Zeiten schnelle, deterministische Healthchecks sichern.
* Gut, weil es sich strikt an generisches OIDC-PKCE-Standards hält ohne benutzerdefinierte Java-Theme-JARs.
* Schlecht, weil Umgebungsvariablen und Container-Definitionen erneut gemappt werden müssen.

### Option 3: In-House Custom Auth Server

* Gut, weil es externe IAM-Abhängigkeiten vollständig eliminiert.
* Schlecht, weil das Erstellen und Warten eines sicheren, compliant OIDC-Servers hohen Wartungs-Overhead und Sicherheits-Risiko einführt.
