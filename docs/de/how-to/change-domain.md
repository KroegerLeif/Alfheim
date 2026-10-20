---
title: "Domain einer Installation wechseln"
description: "Eine bestehende Alfheim-Instanz mit alfheim-setup --reconfigure auf einen neuen App- oder Auth-Host umziehen, ohne Daten, Secrets oder Konten zu verlieren."
---

Diese Anleitung zieht eine laufende Alfheim-Instanz auf neue Hostnamen um, zum
Beispiel von `alfheim.old.example` / `auth.old.example` auf
`alfheim.example.com` / `auth.example.com`. Eine Neuinstallation ist nicht
nötig: Daten, Secrets, Benutzerkonten und Haushalte bleiben erhalten.

## Was sich ändert und was bleibt

| Ändert sich | Bleibt |
| :--- | :--- |
| `DOMAIN`, `ALFHEIM_HOST`, `ZITADEL_EXTERNALDOMAIN` in `.env` | Alle Secrets, auch `ZITADEL_MASTERKEY` |
| Die Caddyfile | Alle Datenbanken und Volumes |
| TLS-Zertifikate (Caddy holt neue) | Zitadel-Benutzer, Rollen und die IDs der OIDC-Clients |
| OIDC-Redirect-URIs (neu registriert) | Die TLS-Strategie, sofern du keine andere wählst |

Zitadel zieht seine Instanz beim nächsten Start mit der neuen
`ZITADEL_EXTERNALDOMAIN` selbst auf den neuen Auth-Host um (Setup-Schritt
`config_change`).

---

## Voraussetzungen

* DNS-Einträge für **beide** neuen Hosts, die auf den Server zeigen.
* Bei einer DNS-01-Strategie (Hetzner, Cloudflare, deSEC): ein Token, der die
  neue Zone bearbeiten darf. Liegt die Zone in einem anderen Konto, dort einen
  Token anlegen.
* Ein Backup, wie vor jeder Änderung: [Backup und Wiederherstellung](./backup-restore.md).

## Schritt 1: Assistent erneut ausführen

```bash
cd /root && alfheim-setup --reconfigure
```

Neue Domain und neuen App-Host eingeben. Headless alle Antworten erneut
übergeben:

```bash
alfheim-setup --reconfigure --non-interactive \
  --domain example.com --app-host alfheim.example.com \
  --tls desec --api-token "$DESEC_TOKEN" \
  --admin-email ops@example.com
```

Der Installer zeigt die Änderung an, bevor er sie anwendet:

```
Domain change: alfheim.old.example / auth.old.example -> alfheim.example.com / auth.example.com
```

## Schritt 2: Durchlaufen lassen

Der Installer startet Caddy und Zitadel mit der neuen Konfiguration neu,
wartet auf die neuen Zertifikate (*Phase: Certificates*), registriert die
Redirect-URIs in Zitadel neu und startet alle Apps mit der neuen Issuer-URL.

## Prüfen

1. `https://<neuer App-Host>` öffnen und anmelden.
2. Zertifikat prüfen:

   ```bash
   echo | openssl s_client -connect 127.0.0.1:443 -servername auth.example.com 2>/dev/null \
     | openssl x509 -noout -subject -issuer -dates
   ```

## Danach

* Lesezeichen und installierte PWAs zeigen auf den alten Host; ersetzen.
* Alte DNS-Einträge entfernen, sobald nichts sie mehr nutzt.
* Spätere Updates brauchen nichts Besonderes: `alfheim-setup update` nutzt die
  neue Konfiguration.

## Siehe auch

* [Installer-CLI-Referenz](../reference/installer-cli.md)
* [Wildcard-TLS mit deSEC DNS-01](./desec-dns-tls.md)
* [Installation aktualisieren](./update-installation.md)
