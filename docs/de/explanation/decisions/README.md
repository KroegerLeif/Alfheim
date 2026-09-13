---
title: "Architektur-Entscheidungs-Records"
description: "Zentrales Log von Architektur-Entscheidungs-Records für Alfheim, formatiert mit MADR (Markdown Architectural Decision Records)."
sidebar:
  label: "Übersicht"
---

> **Kurzfassung:** Zentrales Log von Architektur-Entscheidungs-Records für Alfheim, formatiert mit [MADR (Markdown Architectural Decision Records)](https://adr.github.io/madr/).

---

## 📋 Architektur-Entscheidungs-Index

| ADR ID | Titel | Status | Datum | Entscheidungs-Zusammenfassung |
| :--- | :--- | :--- | :--- | :--- |
| [`0000`](./0000-template.md) | MADR-Vorlage | Aktiv | 2026-03-01 | Standardisiertes Entscheidungs-Record-Format. |
| [`0001`](./0001-diataxis-documentation.md) | Diátaxis-Dokumentation & App-Konsolidierung | Akzeptiert | 2026-03-01 | Übernehme Diátaxis, zentralisiere `/docs/`, konsolidiere App-READMEs. |
| [`0002`](./0002-feature-driven-design.md) | Feature-Driven Design Monorepo Architektur | Akzeptiert | 2026-03-01 | Erzwinge FDD-Feature-Unterverzeichnisse und 200-LOC-Limit. |
| [`0003`](./0003-migrate-from-keycloak-to-zitadel.md) | Migration von Keycloak zu Zitadel | Akzeptiert | 2026-03-01 | Übernehme Zitadel für Identität & AuthN; behalte Haushalt AuthZ in Alfheim Core. |
| [`0004`](./0004-standalone-go-tui-installer.md) | Standalone-Installer als typiertes Go-TUI | Akzeptiert | 2026-09-12 | Übernehme einen Go + Charm `huh`-Installer unter `tools/installer`; entkopple Zitadel-Bootstrapping in zwei Phasen. |
| [`0005`](./0005-starlight-docs-portal.md) | Astro-Starlight-Dokumentations-Portal mit i18n | Akzeptiert | 2026-09-12 | Rendere den Diátaxis-Korpus als durchsuchbaren Portal; Englisch-Standard, Deutsch-Fallback. |
