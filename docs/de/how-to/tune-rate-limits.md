---
title: "Rate-Limits des Gateways anpassen"
description: "Die Anfrage-Limits pro IP erhöhen oder senken, die Caddy auf den Zitadel-Login, den Auth-Host, die APIs und die externen Lookups anwendet."
sidebar:
  label: "Rate-Limits anpassen"
---

Caddy begrenzt, wie viele Anfragen eine Client-IP pro Minute senden darf. Die
Limits stoppen Passwort-Raten am Zitadel-Login, skriptgesteuerten Missbrauch der
APIs und Lookups, die die Kontingente von ISBN, BoardGameGeek, TMDB und Open
Food Facts aufbrauchen würden. Die
[Ingress-Matrix](../reference/ingress-matrix.md#rate-limits) listet jede Zone und
was sie trifft.

Die Standardwerte passen für einen Haushalt hinter einer öffentlichen IP. Ändere
sie nur, wenn wirklich jemand an ein Limit stößt, oder um eine aus dem Internet
erreichbare Instanz enger einzustellen.

## Eine gedrosselte Anfrage erkennen

Eine gedrosselte Anfrage erhält `429 Too Many Requests` mit einem
`Retry-After`-Header (Sekunden). Eine App zeigt ihren üblichen Fehler für eine
fehlgeschlagene Anfrage; der API-Body lautet
`{"error":"rate_limited","message":"Too many requests. Try again in a minute."}`.
Der Zähler ist ein gleitendes Ein-Minuten-Fenster, der Zugriff kommt also
innerhalb einer Minute von selbst zurück.

Caddy führt kein Access-Log, gedrosselte Anfragen erscheinen also nicht in
`docker logs alfheim_caddy`. Suche stattdessen in den Entwicklerwerkzeugen des
Browsers (Tab „Netzwerk“) nach Status `429`.

## Ein Limit ändern

Jedes Limit ist eine Anzahl Anfragen pro Minute und Client-IP und wird aus der
Umgebung des Caddy-Containers gelesen:

| Variable | Standard | Gilt für |
| :--- | :--- | :--- |
| `ALFHEIM_RATE_LIMIT_LOGIN` | `30` | Formular-Posts an den Zitadel-Login (`/ui/login/*`): Passwort, MFA, Registrierung |
| `ALFHEIM_RATE_LIMIT_AUTH` | `600` | Jede Anfrage an den `auth.*`-Host, inklusive Login-Assets, Konsole und OIDC-Aufrufe |
| `ALFHEIM_RATE_LIMIT_API` | `1200` | Jede `/api/v1`-Anfrage auf dem App-Host |
| `ALFHEIM_RATE_LIMIT_LOOKUP` | `60` | ISBN-/BGG-/TMDB-Lookups der Bibliothek und Barcode-Lookups der Vorratskammer |

1. Trage die Variable in die `.env` im Installationsverzeichnis ein, zum
   Beispiel für mehr Barcode-Scans pro Minute:

   ```bash
   ALFHEIM_RATE_LIMIT_LOOKUP=120
   ```

2. Erzeuge den Caddy-Container neu, damit er den Wert übernimmt:

   ```bash
   docker compose -f compose.prod.yaml up -d caddy
   ```

3. Prüfe, dass der Wert im Container angekommen ist:

   ```bash
   docker exec alfheim_caddy printenv ALFHEIM_RATE_LIMIT_LOOKUP
   ```

Das erzeugte Caddyfile liest diese Variablen, die Änderung übersteht also
`alfheim-setup --reconfigure` und Updates. Im Entwicklungs-Stack exportierst du
die Variable vor `./scripts/up.sh` in der Shell und reichst sie über
`infrastructure/caddy/compose.yml` durch, oder du änderst den Standardwert in
`infrastructure/caddy/Caddyfile`.

## Hinter einem weiteren Reverse Proxy

Die Limits hängen an der Client-IP, die Caddy sieht. Sitzt Alfheim hinter einem
weiteren Proxy oder Tunnel (Reverse Proxy des Routers, Cloudflare Tunnel),
kommen alle Besucher mit der IP dieses Proxys an und teilen sich ein Budget.
Erhöhe dann entweder die Limits, bis alle Nutzer hineinpassen, oder lass Caddy
dem `X-Forwarded-For`-Header des Proxys vertrauen, indem du `trusted_proxies` in
die globalen Optionen von `infrastructure/caddy/Caddyfile` einträgst:

```caddyfile
{
	servers {
		trusted_proxies static 192.168.1.10/32
	}
}
```

Der Installer verwaltet diese Einstellung nicht, `alfheim-setup --reconfigure`
überschreibt sie also; trage sie nach einem Reconfigure erneut ein.

## Die Limits prüfen

`./scripts/test-gateway-hardening.sh` startet das Caddy-Image allein mit
niedrigen Limits und prüft, dass jede Zone über ihrem Limit mit 429 antwortet
und Verkehr darunter durchlässt. Es läuft im Workflow `smoke-test.yml`.

## Verwandt

- [Ingress-Matrix: Rate-Limits](../reference/ingress-matrix.md#rate-limits)
- [Umgebungsvariablen](../reference/environment-variables.md)
