---
title: "ADR 0005: Astro Starlight Dokumentations-Portal mit i18n"
sidebar:
  label: "0005 Starlight-Portal"
---

* Status: akzeptiert
* Deciders: Alfheim Core Architecture Team
* Datum: 2026-09-12

Technische Story: [#354](https://github.com/KroegerLeif/Alfheim/issues/354)

---

## Kontext und Problembeschreibung

[ADR 0001](./0001-diataxis-documentation.md) etablierte die Diátaxis-Struktur unter `docs/`, aber das Ergebnis war ein plain Verzeichnis von Markdown-Dateien. Es hatte keine Full-Text-Suche, keine Navigation über eine hand-gepflegte Indexhinaus, und keinen Pfad zu einer zweiten Sprache. Während der Korpus vorbei zwei Dutzend Dokumente wuchs, erfordert das Findet irgendetwas, dass entweder den Dateinamen weiß oder das Index top-down liest.

Getrennt, die neun Anwendungs-READMEs gemischt jede alle vier Diátaxis-Modalitäten in eine Datei, daher war die Spezifikations-Content unsichtbar für irgendjemand, nicht bereits das Verzeichnis browst.

## Entscheidungs-Treiber

* **Suche.** Offline Full-Text-Suche über den kompletten Korpus, mit null API und null Ratelimits.
* **Toolchain-Ausrichtung.** Das Repository ist ein TypeScript-Monorepo; das Hinzufügen einer Python-Runtime zur Dokumentations-Build-Step war nicht akzeptabel.
* **Einzelne Quelle der Wahrheit.** Markdown muß auf GitHub browsebar bleiben. Ein Build-Step, der Content in eine zweite Lokation kopiert, würde driften.
* **Inkrementelle Übersetzung.** Deutsche Seiten müssen eine-zu-einer-Zeit addierbar sein ohne 404s hinter den noch-nicht-geschriebenen zu lassen.

## Betrachtete Optionen

* **Option 1: Astro Starlight** — TypeScript-native SSG mit eingebauter Pagefind-Suche und erster-Klasse i18n-Fallback.
* **Option 2: MkDocs Material** — gereift und Feature-reich, aber führt Python zur CI-Dokumentations-Build ein.
* **Option 3: Docusaurus** — React-basiert, aber schwerer bei Runtime und seine i18n-Modell ist um extrahierte Übersetzungs-Dateien raum als parallele Content-Bäume.
* **Option 4: Behalte plain Markdown** — Null-Build-Kosten, aber keiner der Treiber sind erfüllt.

## Entscheidungs-Ergebnis

Gewählte Option: **Astro Starlight**, in einem dedizierten `websites/portal`-Paket.

Drei Entscheidungen sind Wert aufzuzeichnen übrig die Engine-Wahl hinaus:

**Der Content bleibt bei Repository-Root.** Starlight's `docsLoader()` ist hardcoded zu `src/content/docs/`. Statt 24 Dateien ins Astro-Paket verschieben, `src/content.config.ts` nutzt einen Glob-Loader basierend bei `../../docs`. Das Markdown bleibt daher browsebar auf GitHub und bleibt die einzelne Quelle der Wahrheit, während das Astro-Paket nur die Build-Toolchain hält.

**Englisch ist die Standard-Locale.** Der bestehende Korpus war bereits Englisch, und `.ai/rules/core.md` mandiert Englisch für Code und Commits. Starlight's Fallback ist asymmetrisch — fehlende Seiten werden aus der Standard-Locale generiert — daher das Machen von Deutsch der Standard hätte alle 24 Dokumente upfront übersetzen benötigt und hätte Deutsch die Sprache gemacht, dass jeder zukünftig Change anfängt.

**App READMEs sind geteilt, nicht verschoben.** Die Spezifikations-Hälfte jeder README verschiebt zu `docs/en/reference/apps/<app>.md`; die Dev-Quickstart bleibt in `apps/<app>/README.md`. Das Umbenennen der READMEs zu `<app>.md` war rejected: GitHub auto-rendert `README.md` in einer Verzeichnis-Liste, daher würde das Umbenennen Discoverability reduziert raum verbessert haben. Sie ganz verschieben war auch rejected: Jemand arbeitend in `apps/<app>/` braucht die Dev-Befehle dort.

### Konsequenzen

* Gut, weil Pagefind Offline-Full-Text-Suche mit null Runtime-Service gibt.
* Gut, weil die Dokumentations-Build die bestehende pnpm und Node-Toolchain renutzt.
* Gut, weil unübersetzte Deutschen Pfade Englisch-Content mit einer Notiz dienen statt 404ing, daher kann Übersetzung Seite-für-Seite fortschreiten.
* Schlecht, weil die Dokumentations-Build jetzt Node >= 22.12 erfordert, welch die Pages-Workflow von Node 20 zu 22 erzwungen hat.
* Schlecht, weil das Portal und die Landing-Seite zwei Build-Steps sind, die vom Workflow gemischt werden, welch mehr Bewegungs-Teile als ein single Site ist.

## Pros und Cons der Optionen

### Option 2: MkDocs Material

* Gut, weil es gereift ist mit einem großen Plugin-Ökosystem.
* Schlecht, weil es Python zur CI-Dokumentations-Build erfordert, welch ADR 0004 bereits vom Installer-Pfad arbeitet zu entfernen.

### Option 3: Docusaurus

* Gut, weil es weit übernommen ist und React-basiert wie der Rest des Stacks.
* Schlecht, weil es erheblich mehr Runtime-JavaScript für eine statische Dokument-Site verschifft.
* Schlecht, weil seine i18n-Modell Zentren auf extrahierte Übersetzungs-Dateien raum als parallele Content-Bäume, welch ein UI besser paßt als ein Dokument-Korpus.

---

## Links

* [ADR 0001: Übernahme des Diátaxis-Dokumentations-Frameworks](./0001-diataxis-documentation.md)
* [Portal Paket README](../../../../websites/portal/README.md)
