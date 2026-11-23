---
title: Alfheim Dokumentation
description: Zentrale Wissensbasis für Alfheim Sovereign OS, strukturiert nach dem Diátaxis-Framework.
template: splash
hero:
  tagline: Ein Local-first-Haushalts-OS auf deiner eigenen Hardware, vom kleinen Lean Core bis zu allen optionalen Apps.
  actions:
    - text: Erste Installation
      link: /docs/de/tutorials/first-run/
      icon: right-arrow
    - text: Auf GitHub ansehen
      link: https://github.com/KroegerLeif/Alfheim
      icon: external
      variant: minimal
---

Alfheim ist ein Local-first-Haushalts-OS: Vorräte, Einkaufslisten, Budget, Aufgaben und die
übrigen Apps laufen auf einem Server bei dir zu Hause, hinter deiner eigenen Anmeldung. Eine
Standardinstallation ist der **Lean Core** (Caddy, PostgreSQL, Zitadel, RustFS, das Dashboard und
die Haushalts-App), der etwa 752 MB RAM reserviert und auf einen Host mit 2 GB passt. Jede weitere
App ist ein optionales Modul, das du mit `alfheim-setup apps enable <name>` einschaltest, wenn der
Haushalt es braucht. Warum der Kern so geschnitten ist, hält
[ADR 0007](../en/explanation/decisions/0007-lean-core-app-set.md) (englisch) fest; die Hardware-Stufen stehen
in der [Installationsanleitung](how-to/homelab-deployment.md).

Einen kurzen Überblick über die Module, die geplanten Integrationen und die Roadmap gibt die
[Projektübersicht](https://docs.alfheim.loegien.de/).

## Wegweiser

Die Dokumentation ist nach dem [Diátaxis-Framework](https://diataxis.fr/) in vier Modi geteilt.

- **Tutorials** — lernorientierte Durchläufe, um Alfheim zum Laufen zu bringen.
- **Anleitungen** — aufgabenorientierte Rezepte für Betrieb und Entwicklung.
- **Referenz** — technische Spezifikationen, Kataloge und CLI-Flags.
- **Hintergrund** — Architektur, Design-Philosophie und Entscheidungsprotokolle.

> **Hinweis:** Seiten ohne deutsche Übersetzung werden automatisch auf Englisch
> ausgeliefert und oben entsprechend gekennzeichnet.
