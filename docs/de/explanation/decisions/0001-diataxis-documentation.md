---
title: "ADR 0001: Übernahme des Diátaxis-Dokumentations-Frameworks"
description: "Technische Story: Dokumentations-Architektur-Audit & Umstrukturierung"
sidebar:
  label: "0001 Diátaxis"
---

* Status: akzeptiert
* Deciders: Alfheim Core Architecture Team
* Datum: 2026-03-01

Technische Story: Dokumentations-Architektur-Audit & Umstrukturierung

---

## Kontext und Problembeschreibung

Die Alfheim-Monorepo-Dokumentation litt unter struktureller Fragmentierung und hohem Wartungs-Overhead:
1. **Dreifach App-READMEs:** Jeder Microservice in `apps/<app>/` unterhielt drei separate Dokumentationsdateien (`apps/<app>/README.md`, `backend/README.md` und `frontend/README.md`), verursachend Konfigurationsdrift bezüglich Ports, Umgebungsvariablen und Gateway-Routes.
2. **Wartungs-Fallen:** Manuelle ASCII-Verzeichnisbäume (`tree` Dumps) in Markdown-Dateien enthielten Datei-Level-Namen und geschätzte Codezeilen (LOC), wodurch Dokumentation nach kleineren Code-Refactorings veraltet wurde.
3. **Mangelnde globale Struktur:** Zentrale Plattform-Architektur-Konzepte (Keycloak OIDC, Caddy-Pfad-Stripping, VictoriaStack-Telemetrie) waren über App-READMEs verstreut ohne dediciertes, strukturiertes globales Dokumentations-Portal.

---

## Entscheidungs-Treiber

* **Einzelne Quelle der Wahrheit:** Duplizierte Konfigurationen eliminieren und Dokumentationsdrift verhindern.
* **Wartbarkeit:** Hochgradig wartungsintensive ASCII-Dateibäume und Tool-spezifische Legacydateien eliminieren.
* **Entwickler-Onboarding:** Klare, strukturierte Navigation basierend auf Benutzer-Intent (Lernen vs. Aufgaben-Ausführung vs. Referenz-Lookup) bereitstellen.

---

## Betrachtete Optionen

* **Option 1: Status Quo** — Beibehalten von dreifachen READMEs pro App und unorganisierten Root-Guides.
* **Option 2: Flacher zentraler Ordner** — Verschiebe alle Markdown-Dateien in einen einzigen flachen `docs/`-Ordner ohne Taxonomie.
* **Option 3: Diátaxis-Framework & konsolidierte App-READMEs** — Organisiere zentrale Dokumentation in vier Diátaxis-Quadranten (`tutorials/`, `how-to/`, `reference/`, `explanation/`), zentralisiere `apps-catalog.md`, und konsolidiere jede App in eine einzelne `apps/<app>/README.md`.

---

## Entscheidungs-Ergebnis

Gewählte Option: **Option 3**, weil Diátaxis ein Industrie-Standard-Framework bietet, das Inhalte nach Benutzer-Intent klar trennt, während die Konsolidierung von App-READMEs Genauigkeit für Entwickler und KI-Agenten der Single-Source-of-Truth sichert.

### Positive Konsequenzen

* **Null Konfigurationsdrift:** Jede App hat genau eine `apps/<app>/README.md`, die ihren Zweck, Ports, Umgebungsvariablen und lokale Befehle definiert.
* **Klare Benutzer-Navigation:** Diátaxis eliminiert Verwirrung durch strikte Trennung von Anfänger-Walkthroughs von operativen How-To-Guides und technischen Referenzen.
* **Reduzierter Wartungs-Overhead:** Entfernen von manuellen ASCII-Dateibäumen stellt sicher, dass Dokumentation über Refactorisierungen hinweg gültig bleibt.

### Negative Konsequenzen & Akzeptierte Kosten

* **Einmalige Migrations-Anstrengung:** Erfordert Umstrukturierung und Konsolidierung von Dokumentation über alle 8 Microservice-Anwendungen und Kerndienste.

---

## Pros und Cons der Optionen

### Option 3 (Diátaxis & Konsolidierung)

* Gut, weil es Inhalte strikt in Tutorials, How-To, Reference und Explanation trennt.
* Gut, weil es eine zentrale `docs/reference/apps-catalog.md` etabliert, die alle Tier-1- und Tier-2-Anwendungen verlinkt.
* Schlecht, weil es die Migration von Legacys `INSTALL.md` und `DEPLOYMENT.md`-Dateien in die neue Struktur erfordert.
