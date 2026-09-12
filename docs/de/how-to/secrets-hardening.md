---
title: "Secrets härten"
description: "Die Secrets einer Alfheim-Instanz erzeugen, ablegen und rotieren — und prüfen, dass kein Entwicklungs-Fallback in die Produktion gelangt."
sidebar:
  label: "Secrets härten"
---

Arbeite diese Anleitung durch, bevor du eine Alfheim-Instanz über deinen eigenen
Rechner hinaus erreichbar machst. Sie behandelt, woher Secrets kommen, wo sie
liegen dürfen und wie du bestätigst, dass kein Entwicklungs-Fallback in die
Produktion gelangt ist.

> Laufende Härtungsarbeiten werden in
> [Issue #359](https://github.com/KroegerLeif/Alfheim/issues/359) verfolgt,
> nicht in diesem Dokument.

---

## Woher Secrets kommen

Schreibe niemals ein Secret von Hand. Beide unterstützten Installationswege
erzeugen jede Zugangsdatei aus einer kryptografischen Zufallsquelle:

```bash
# Interaktiver Installer (empfohlen)
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash

# Oder, bei manueller Installation, aus dem Repository-Wurzelverzeichnis
./scripts/init-env.sh
```

Beide schreiben eine `.env` mit Modus `0600`, die Folgendes enthält:

| Variable | Zweck |
| :--- | :--- |
| `POSTGRES_PASSWORD`, `<app>_DB_PASSWORD` | Datenbank-Eigentümer je Dienst auf `postgres-core` |
| `ZITADEL_MASTERKEY` | Verschlüsselt Zitadels Daten im Ruhezustand. Exakt 32 Zeichen. |
| `ZITADEL_ADMIN_PASSWORD` | Initialer IAM-Administrator |
| `CHAT_ENCRYPTION_KEY` | 32-Byte-Base64-Schlüssel, sichert LLM-API-Schlüssel im Ruhezustand mit AES-256-GCM |
| `S3_SECRET_KEY` | RustFS-Objektspeicher |
| `GRAFANA_ADMIN_PASSWORD` | Observability-Oberfläche |
| `HETZNER_API_TOKEN` / `CLOUDFLARE_API_TOKEN` | ACME DNS-01, nur bei dieser TLS-Strategie |

---

## Wo Secrets liegen dürfen

**In der `.env` — und sonst nirgends.**

Daraus folgen zwei Regeln:

**Entwicklungs-Compose-Dateien enthalten Fallback-Werte.**
`core/dashboard/compose.yml` und `apps/*/compose.yml` liefern Defaults, damit ein
frischer Checkout ohne Einrichtung läuft. Das sind Bequemlichkeitswerte, keine
Secrets. Ein produktives Deployment muss die `.env` explizit einlesen, damit
jeder dieser Werte überschrieben wird.

**Gerenderte Konfiguration darf keine Secrets einbetten.** Das Caddyfile
referenziert ACME-Tokens als `{env.HETZNER_API_TOKEN}`, statt sie einzusetzen —
so bleibt es gefahrlos an eine Support-Anfrage oder ein Backup anhängbar. Erhalte
diese Eigenschaft bei allem, was du ergänzt.

---

## Prüfen, bevor die Instanz erreichbar wird

### 1. Kein Entwicklungs-Fallback übrig geblieben

```bash
grep -E '(password|secret|key|token)' .env | grep -iE 'changeme|postgres$|admin$|Password1!|super_secret'
```

Jeder Treffer ist ein Wert, den der Generator nicht ersetzt hat. Neu erzeugen,
statt von Hand zu editieren:

```bash
./scripts/init-env.sh --force
```

### 2. Dateirechte

```bash
stat -c '%a %n' .env
```

Erwartet wird `600`. Der Installer setzt das; eine Wiederherstellung aus dem
Backup oft nicht.

### 3. Container laufen unprivilegiert

```bash
docker compose -f compose.prod.yaml config | grep -c 'user:'
```

Alle Go- und Python-Backends deklarieren `USER appuser` in ihren Dockerfiles.

### 4. Vollständige Verifikation

```bash
./scripts/verify.sh --security
```

---

## Ein Secret rotieren

1. Stack stoppen: `docker compose -f compose.prod.yaml stop`
2. Wert in der `.env` ersetzen.
3. Neu starten: `docker compose -f compose.prod.yaml up -d`

Zwei Ausnahmen:

* **`ZITADEL_MASTERKEY` lässt sich nicht im laufenden Betrieb rotieren.** Er
  verschlüsselt vorhandene Zitadel-Daten; eine Änderung macht diese unlesbar.
  Rotation bedeutet, den Identity Provider neu zu bootstrappen.
* **`CHAT_ENCRYPTION_KEY` lässt sich nicht rotieren**, ohne zuvor die
  gespeicherten LLM-API-Schlüssel neu zu verschlüsseln. Lösche sie in den
  Chat-Einstellungen, rotiere, gib sie neu ein.

Datenbank-Passwörter müssen zusätzlich in PostgreSQL geändert werden:

```bash
docker exec -it alfheim_postgres_core \
  psql -U postgres -c "ALTER USER pantry_user WITH PASSWORD 'neues-passwort';"
```

---

## Telemetrie-Endpunkte

Grafana und die VictoriaStack-Komponenten sind über das Gateway erreichbar. Wird
die Instanz über ein vertrauenswürdiges Netz hinaus exponiert, prüfe vorher:

* `GRAFANA_ADMIN_PASSWORD` stammt aus der `.env` und ist nicht der Vorlagenwert.
* Grafana-OIDC-SSO ist gegen Zitadel konfiguriert, sodass das lokale
  Admin-Konto ein Notfallzugang bleibt und nicht der Regelweg ist.

---

## Siehe auch

* [Eigene TLS-Zertifikate verwenden](./custom-certificates.md)
* [Wildcard-TLS mit Hetzner DNS-01](./hetzner-dns-tls.md)
* [Backup, Wiederherstellung & Datenmigration](./backup-restore.md)
* [Authentifizierung & Mandantenfähigkeit](../explanation/authentication-security.md)
