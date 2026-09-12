---
title: "Wildcard-TLS mit Hetzner DNS-01"
description: "Wildcard-Zertifikate über die ACME-DNS-01-Challenge ausstellen, wenn die Domain bei Hetzner DNS liegt — ohne eingehenden Port 80."
---

Diese Anleitung stellt Wildcard-Zertifikate für eine Alfheim-Instanz aus, deren
Domain bei Hetzner DNS gehostet ist.

Die ACME-**DNS-01**-Challenge weist den Domainbesitz über einen temporären
TXT-Eintrag nach statt über eine per HTTP ausgelieferte Datei. Das bedeutet:

* Du bekommst ein Wildcard-Zertifikat (`*.example.com`), das `auth.example.com`
  und jede künftige Subdomain mit einem einzigen Zertifikat abdeckt.
* **Eingehender Port 80 ist nicht nötig**, es funktioniert also auch hinter einer
  restriktiven Firewall oder Carrier-Grade-NAT.

> DNS liegt stattdessen bei Cloudflare? Der Ablauf ist identisch — wähle
> *Cloudflare DNS-01* und erzeuge einen Token mit der Berechtigung `Zone:DNS:Edit`.

---

## Voraussetzungen

* Eine Domain, deren Nameserver auf Hetzner DNS zeigen.
* Zugang zur [Hetzner DNS Console](https://dns.hetzner.com/).

## Schritt 1: API-Token erstellen

1. In der Hetzner DNS Console anmelden.
2. Profilmenü öffnen und **API tokens** wählen.
3. **Create access token** wählen und einen sprechenden Namen vergeben, etwa
   `alfheim-acme`.
4. Den Token sofort kopieren — Hetzner zeigt ihn nur einmal an.

Die Hetzner-DNS-API vergibt kontoweite Tokens; sie lassen sich nicht auf eine
einzelne Zone einschränken. Behandle den Token entsprechend als Zugangsdatum, das
jeden DNS-Eintrag deines Kontos ändern kann, und bewahre ihn ausschließlich in der
generierten `.env` auf.

## Schritt 2: Domain auf den Host zeigen lassen

Lege zwei A-Records an (oder AAAA für IPv6):

| Typ | Name   | Wert                 |
| :-- | :----- | :------------------- |
| A   | `@`    | IP-Adresse des Servers |
| A   | `auth` | IP-Adresse des Servers |

DNS-01 braucht diese Einträge nicht für die Ausstellung — Besucher brauchen sie
aber, um die Instanz zu erreichen.

## Schritt 3: Installer mit dem Token ausführen

Interaktiv **Hetzner DNS-01 (wildcard)** wählen und den Token einfügen. Headless:

```bash
alfheim-setup --non-interactive \
  --domain example.com \
  --tls hetzner \
  --api-token "$HETZNER_API_TOKEN" \
  --admin-email ops@example.com
```

Der Token wird als `HETZNER_API_TOKEN` in die `.env` geschrieben und im Caddyfile
über `{env.HETZNER_API_TOKEN}` referenziert:

```caddyfile
{
	admin off
	email ops@example.com
	acme_dns hetzner {env.HETZNER_API_TOKEN}
}
```

Das gerenderte Caddyfile enthält den Token damit nie im Klartext und kann gefahrlos
in eine Support-Anfrage oder ein Konfigurations-Backup kopiert werden.

## Schritt 4: Erste Ausstellung beobachten

Das erste Zertifikat dauert ein bis zwei Minuten, weil Caddy auf die Propagierung
des TXT-Eintrags warten muss:

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

Als Aussteller sollte Let's Encrypt erscheinen, mit einem Gültigkeitsbeginn von heute.

---

## Fehlersuche

**`could not determine zone for domain`**
Der Token sieht die Zone nicht. Prüfe, ob die Domain tatsächlich in der Hetzner DNS
Console gehostet ist und ob der Token unter demselben Konto erstellt wurde.

**Zeitüberschreitung bei der Zertifikatsausstellung**
Die TXT-Propagierung ist langsam. Prüfe, ob der Challenge-Eintrag erscheint:

```bash
dig +short TXT _acme-challenge.example.com
```

Erscheint nichts, fehlt dem Token der Schreibzugriff oder die Zone wird von anderen
Nameservern bedient.

**`unrecognized directive: acme_dns`**
Das Gateway läuft auf dem Standard-Caddy-Image, das keine DNS-Provider-Module
enthält. Alfheim baut ein eigenes aus `infrastructure/caddy/Dockerfile`; baue es neu
mit `docker compose -f compose.prod.yaml build caddy`. Siehe
[ADR 0004](../../en/explanation/decisions/0004-standalone-go-tui-installer.md).

## Token rotieren

1. Einen Ersatz-Token in der Hetzner DNS Console erstellen.
2. `HETZNER_API_TOKEN` in der `.env` aktualisieren.
3. Gateway neu starten: `docker compose -f compose.prod.yaml up -d caddy`.
4. Den alten Token löschen.

Es wird kein Zertifikat neu ausgestellt — Caddy nutzt das vorhandene bis zur Erneuerung weiter.

## Siehe auch

* [Eigene TLS-Zertifikate](../../en/how-to/custom-certificates.md)
* [Installer-CLI-Referenz](../../en/reference/installer-cli.md)
* [Secrets Hardening](../../en/how-to/secrets-hardening.md)
