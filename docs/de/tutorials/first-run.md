---
title: "Deine erste Alfheim-Installation"
description: "Alfheim auf einem frischen Debian-12-Host installieren — am Ende laufen Dashboard, Identity Provider und Ingress-Gateway."
sidebar:
  label: "Erste Installation"
---

Dieses Tutorial führt dich durch die Installation von Alfheim auf einem frischen
Debian-12-Host — Bare-Metal-Server, Proxmox-VM oder LXC-Container. Am Ende läuft
eine Instanz mit funktionierendem Dashboard, Identity Provider und Ingress-Gateway.

Plane etwa 30 Minuten ein; der Großteil davon ist Wartezeit auf Container-Images.

> **Tutorial, keine Referenz.** Diese Seite geht bewusst einen einzigen Weg. Alle
> Flags und Optionen stehen in der [Installer-CLI-Referenz](../../en/reference/installer-cli.md).

---

## Bevor du startest

Du brauchst:

* Einen Debian-12-Host (oder vergleichbar) mit mindestens 4 GB RAM und 20 GB freiem Speicher.
* Root- oder `sudo`-Zugriff.
* Eine Domain, die du kontrollierst, mit DNS-Eintrag auf den Host. Dieses Tutorial
  verwendet `example.com`; ersetze sie durchgehend durch deine eigene.

## Schritt 1: Docker installieren

Der Installer benötigt Docker Engine und das Compose-v2-Plugin:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Beides prüfen:

```bash
docker info && docker compose version
```

Scheitert `docker info` an fehlenden Rechten, füge dich der Gruppe `docker` hinzu
und öffne eine neue Login-Shell:

```bash
sudo usermod -aG docker "$USER"
```

## Schritt 2: Installationsverzeichnis wählen

Alfheim hält Konfiguration, generierte Secrets und persistente Daten in einem
gemeinsamen Verzeichnis:

```bash
mkdir -p ~/alfheim && cd ~/alfheim
```

## Schritt 3: Installer ausführen

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
```

Das Skript erkennt die CPU-Architektur, lädt das passende `alfheim-setup`-Binary,
prüft dessen SHA-256-Checksumme und startet den Wizard.

> **Warum das per Pipe nach `bash` funktioniert.** Das Skript hängt seine Eingabe
> vor der Übergabe wieder an `/dev/tty`, sodass der Vollbild-Wizard ein Terminal findet.

## Schritt 4: Den Wizard beantworten

Der Wizard fragt vier Dinge ab:

1. **Deployment-Ziel.** Wähle *Custom domain* und gib `example.com` ein. Der
   Dashboard-Host entspricht standardmäßig deiner Basis-Domain; der Identity
   Provider liegt immer auf `auth.example.com`.
2. **Administrator-E-Mail.** Dient als ACME-Kontakt und als Zitadel-Admin-Kontakt.
3. **Zertifikatsstrategie.** Wähle *Hetzner DNS-01* oder *Cloudflare DNS-01*, wenn
   deine Domain dort gehostet ist — das stellt Wildcard-Zertifikate aus und
   benötigt keinen eingehenden Port 80. Andernfalls wähle *Custom certificates*
   oder *Caddy internal CA* für eine reine LAN-Installation.
4. **DNS-API-Token**, falls du eine DNS-01-Strategie gewählt hast. Wie du eines
   anlegst, steht unter [Wildcard-TLS mit Hetzner DNS-01](../../en/how-to/hetzner-dns-tls.md).

Anschließend erzeugt der Installer sämtliche Zugangsdaten aus `crypto/rand` und schreibt:

* `.env` — gesamte Konfiguration und Secrets, Modus `0600`
* `infrastructure/caddy/Caddyfile` — die gerenderte Ingress-Konfiguration

## Schritt 5: Zitadel-Administrator anlegen

Der Installer startet Datenbank, Ingress-Gateway und Zitadel, wartet bis alle drei
gesund sind — und **pausiert dann**:

```
The identity provider is up and holds a certificate.

  1. Open https://auth.example.com
  2. Sign in with the administrator credentials from .env
  3. Complete the initial onboarding
```

Diese Pause ist Absicht. Kein Anwendungsdienst kann eine Anmeldung verifizieren,
solange in Zitadel kein Administrator existiert — und dieses Konto lässt sich nur
über den Browser anlegen.

Das generierte Passwort findest du so:

```bash
grep ZITADEL_ADMIN_PASSWORD .env
```

Öffne `https://auth.example.com`, melde dich als `admin` mit diesem Passwort an und
schließe das Zitadel-Onboarding ab.

## Schritt 6: Anwendungs-Stack starten

Zurück im Terminal die Abfrage bestätigen. Der Installer lädt und startet die
restlichen Dienste und gibt danach deine Zugriffs-URLs aus:

```
Alfheim is up.

  Dashboard       https://example.com
  Identity        https://auth.example.com
  Observability   https://example.com/grafana/
```

## Schritt 7: Prüfen

```bash
docker compose -f compose.prod.yaml ps
```

Jeder Dienst sollte `running` melden, Dienste mit Healthcheck zusätzlich `healthy`.
Öffne die Dashboard-URL und melde dich mit deinem Zitadel-Konto an.

---

## Was du gebaut hast

* Eine vollständige Alfheim-Instanz mit einzigartigen, zufällig erzeugten Zugangsdaten.
* Ein TLS-terminierendes Ingress-Gateway mit Zertifikaten für deine Domain.
* Einen Zitadel Identity Provider mit Administrator-Konto.

## Nächste Schritte

* [Wildcard-TLS mit Hetzner DNS-01](../../en/how-to/hetzner-dns-tls.md) — Wildcard-Zertifikate
* [Eigene TLS-Zertifikate](../../en/how-to/custom-certificates.md) — Bring your own
* [Installer-CLI-Referenz](../../en/reference/installer-cli.md) — jedes Flag
* [Backup & Wiederherstellung](../../en/how-to/backup-restore.md) — Daten sichern

## Später aktualisieren

Wird der Installer erneut im selben Verzeichnis ausgeführt, erkennt er die
bestehende Installation und wechselt in den Update-Modus: Er lädt neue Images und
startet neu, erzeugt aber niemals deine Secrets neu.

```bash
cd ~/alfheim && curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
```

Um die Konfiguration selbst zu ändern, ergänze `--reconfigure`.
