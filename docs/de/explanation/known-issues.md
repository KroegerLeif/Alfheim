---
title: "Bekannte Probleme & Systemkompromisse"
description: "Zentrales Register akzeptierter Architekturkompromisse, Umgebungsgrenzen und bekannter Betriebskosten. Software-Bugs gehören in den Issue-Tracker."
sidebar:
  label: "Bekannte Probleme"
---

> **Kurzfassung:** Zentrales Register akzeptierter Architekturkompromisse, Umgebungsgrenzen und bekannter Betriebskosten im Alfheim-Ökosystem. Software-Bugs gehören in den Issue-Tracker des Repositories.

---

## 📋 Akzeptierte Kosten & Umgebungsgrenzen

| Subsystem | Symptom / Verhalten | Ursache & akzeptierte Kosten | Umgehung / Betriebliche Maßnahme |
| :--- | :--- | :--- | :--- |
| **Caddy / macOS** | Loopback-DNS-Auflösung für `.localhost`-Subdomains schlägt nach dem Ruhezustand fehl | Isolationsproblem der Docker-Desktop-Bridge unter macOS | `docker exec -it alfheim_caddy caddy reload --config /etc/caddy/Caddyfile` ausführen |
| **Caddy / TLS `internal`** | Browser zeigen für jeden Alfheim-Host eine Zertifikatswarnung, auch beim LAN-Preset `.localhost` | Die Anmeldung braucht HTTPS (Web Crypto gibt es nur in einem sicheren Kontext), deshalb liefert die Strategie `internal` HTTPS aus, signiert von einer privaten, vom Installer erzeugten Root-CA. Kein Browser vertraut dieser Root von sich aus | `infrastructure/ca/alfheim-root-ca.crt` nach Prüfung des Fingerprints einmal pro Gerät importieren. Siehe [Der lokalen Root-CA vertrauen](../how-to/trust-local-root-ca.md) |
| **Browser / TLS `internal`** | Wird die Warnung nur für den App-Host akzeptiert, scheitert die Anmeldung mit *Sign-in service not reachable* | Browser speichern Zertifikatsausnahmen pro Host und zeigen bei Hintergrundanfragen keine Warnseite, daher wird die Discovery-Anfrage an den Auth-Host still abgelehnt | Root-CA importieren oder vor der Anmeldung **beide** Hosts, App-Host und Auth-Host, öffnen und die Warnung akzeptieren |
| **Telemetrie / Vector** | 100 ms Latenzpuffer bei der Zustellung strukturierter Logs an VictoriaLogs | Asynchrones OTLP-Micro-Batching in Vector, um CPU-Last der Container gering zu halten | Ungepufferte Container-Logs bleiben über `docker logs <container>` sofort verfügbar |
| **Python-Workspaces** | Microservices benötigen `context: ../..` als Build-Root in Docker Compose | Die `uv`-Workspace-Auflösung braucht Zugriff auf die Wurzel-`pyproject.toml` und die Workspace-Pakete (`packages/backend-shared`) | Der Docker-Build-Kontext ist in den Compose-Dateien auf die Monorepo-Wurzel gesetzt |

---

## 🗓️ Geplante Änderungen (keine akzeptierten Trade-offs)

Bekannte Lücken mit geplanter Behebung. Sie stehen hier, damit Betreiber das Symptom erkennen; es sind keine akzeptierten Kosten.

| Subsystem | Symptom / Verhalten | Ursache | Geplante Änderung & Übergangslösung |
| :--- | :--- | :--- | :--- |
| **Haushalts-Autorisierung** | Anfragen mit `X-Household-ID` (von Frontends gesendet, sobald ein Haushalt gewählt ist) werden mit `403` abgelehnt | Die Haushaltsmitgliedschaft verwaltet das Dashboard (später eine eigene Haushalts-App); Zitadel authentifiziert nur. Die Backends erwarten noch einen Claim `household_id` / `active_household_id` im Access-Token, den Zitadel nicht ausstellt, daher lässt sich der Header nie bestätigen | Die Backends werden die Mitgliedschaft über das Dashboard statt über Token-Claims auflösen. Bis dahin scheitern haushaltsbezogene Anfragen; wird `alfheim_active_household_id` im Browser geleert, entfällt der Header, und die Apps beschränken sich auf private Daten |
