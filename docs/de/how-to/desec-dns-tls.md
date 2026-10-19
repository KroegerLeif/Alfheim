---
title: "Wildcard-TLS mit deSEC DNS-01"
description: "Wildcard-Zertifikate über die ACME-DNS-01-Challenge ausstellen, wenn die Domain bei deSEC liegt — ohne eingehenden Port 80."
---

Diese Anleitung stellt Wildcard-Zertifikate für eine Alfheim-Instanz aus, deren
Domain bei [deSEC](https://desec.io) gehostet ist, dem kostenlosen DNS-Hosting
mit DNSSEC.

Die ACME-**DNS-01**-Challenge belegt den Domainbesitz über einen temporären
TXT-Eintrag statt über eine Datei per HTTP, daher ist **kein eingehender Port 80
nötig**. Der Ablauf entspricht
[Wildcard-TLS mit Hetzner DNS-01](./hetzner-dns-tls.md); nur der Token und die
Caddyfile-Syntax unterscheiden sich.

---

## Voraussetzungen

* Eine Domain, deren Nameserver auf deSEC zeigen (`ns1.desec.io`, `ns2.desec.org`).
* Ein Konto bei [desec.io](https://desec.io/login).

## Schritt 1: API-Token anlegen

1. Im deSEC-Webinterface anmelden.
2. **Token Management** öffnen und mit **+** einen Token anlegen.
3. Einen erkennbaren Namen vergeben, zum Beispiel `alfheim-acme`.
4. Den Token sofort kopieren — deSEC zeigt ihn nur einmal an.

deSEC-Tokens lassen sich über Scoping-Policies einschränken. Erlaube am besten
nur Schreibzugriff auf `_acme-challenge`-TXT-Einträge deiner Domain.

## Schritt 2: Domain auf den Host zeigen lassen

Lege bei deSEC zwei A-Einträge (oder AAAA für IPv6) an:

| Typ | Name   | Wert                |
| :-- | :----- | :------------------ |
| A   | `@`    | IP deines Servers   |
| A   | `auth` | IP deines Servers   |

## Schritt 3: Installer mit dem Token ausführen

Interaktiv **deSEC DNS-01 (wildcard)** wählen und den Token einfügen. Headless:

```bash
alfheim-setup --non-interactive \
  --domain example.com \
  --tls desec \
  --api-token "$DESEC_TOKEN" \
  --admin-email ops@example.com
```

Der Token landet als `DESEC_TOKEN` in `.env` und wird in der Caddyfile als
`{env.DESEC_TOKEN}` referenziert. Das deSEC-Modul akzeptiert den Token nur als
Block-Unterdirektive:

```caddyfile
{
	admin off
	email ops@example.com
	acme_dns desec {
		token {env.DESEC_TOKEN}
	}
}
```

Die gerenderte Caddyfile enthält den Token selbst also nie.

## Schritt 4: Erste Ausstellung beobachten

```bash
docker compose -f compose.prod.yaml logs -f caddy
```

Erfolg sieht so aus:

```
certificate obtained successfully  {"identifier": "example.com"}
```

## Prüfen

```bash
echo | openssl s_client -connect auth.example.com:443 -servername auth.example.com 2>/dev/null \
  | openssl x509 -noout -issuer -dates
```

Aussteller sollte Let's Encrypt sein, mit einem Gültigkeitszeitraum ab heute.

---

## Fehlerbehebung

**`missing token`**
`DESEC_TOKEN` ist im Gateway-Container leer. `.env` prüfen und das Gateway mit
`docker compose -f compose.prod.yaml up -d caddy` neu starten.

**Ausstellung läuft in einen Timeout**
deSEC begrenzt die Änderungsrate und verteilt Einträge innerhalb von etwa einer
Minute auf sein Anycast-Netz. Prüfen, ob der Challenge-Eintrag erscheint:

```bash
dig +short TXT _acme-challenge.example.com @ns1.desec.io
```

Erscheint nichts, fehlt dem Token der Schreibzugriff auf die Zone oder eine
Scoping-Policy blockiert `_acme-challenge`-TXT-Einträge.

**`module not registered: dns.providers.desec`**
Das Gateway läuft mit einem Image von vor der deSEC-Unterstützung. Neu ziehen
oder bauen: `docker compose -f compose.prod.yaml pull caddy` oder
`docker compose -f compose.prod.yaml build caddy`.

## Token rotieren

1. Bei deSEC einen neuen Token anlegen.
2. `DESEC_TOKEN` in `.env` aktualisieren.
3. Gateway neu starten: `docker compose -f compose.prod.yaml up -d caddy`.
4. Den alten Token löschen.

## Siehe auch

* [Wildcard-TLS mit Hetzner DNS-01](./hetzner-dns-tls.md)
* [Installer-CLI-Referenz](../reference/installer-cli.md)
* [Secrets-Härtung](./secrets-hardening.md)
