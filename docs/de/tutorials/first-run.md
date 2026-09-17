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

* Einen Debian-12-Host (oder vergleichbar) mit mindestens 4 GB RAM und 10 GB freiem Speicher.
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
2. **Administrator-E-Mail.** Wird Anmeldename des Zitadel-Administrators und ACME-Kontakt.
3. **Zertifikatsstrategie.** Wähle *Hetzner DNS-01* oder *Cloudflare DNS-01*, wenn
   deine Domain dort gehostet ist — das stellt Wildcard-Zertifikate aus und
   benötigt keinen eingehenden Port 80. Andernfalls wähle *Custom certificates*
   oder *Local CA (self-signed HTTPS)* für eine reine LAN-Installation. Mit der
   lokalen CA importierst du nach der Installation
   `infrastructure/ca/alfheim-root-ca.crt` in den Zertifikatsspeicher deines
   Betriebssystems oder Browsers. Sonst musst du die Zertifikatswarnung vor der
   Anmeldung für **beide** Hosts akzeptieren, App-Host und Auth-Host (siehe
   [Der lokalen Root-CA vertrauen](../how-to/trust-local-root-ca.md)).
4. **DNS-API-Token**, falls du eine DNS-01-Strategie gewählt hast. Wie du eines
   anlegst, steht unter [Wildcard-TLS mit Hetzner DNS-01](../../en/how-to/hetzner-dns-tls.md).

Anschließend erzeugt der Installer sämtliche Zugangsdaten aus `crypto/rand` und schreibt:

* `.env` — gesamte Konfiguration und Secrets, Modus `0600`
* `infrastructure/caddy/Caddyfile` — die gerenderte Ingress-Konfiguration

## Schritt 5: Den Installer durchlaufen lassen

Der Installer startet Datenbank, Ingress-Gateway und Zitadel, wartet, bis alle drei
gesund sind, und richtet Zitadel dann selbst ein: Er legt das Projekt `Alfheim`,
einen Anmelde-Client für das Dashboard und alle Apps sowie einen Client für Grafana
an und schreibt deren IDs in die `.env`. Danach lädt und startet er die restlichen
Dienste und gibt deine Zugriffs-URLs und den Administrator-Login aus:

```
Alfheim is up.

  Dashboard       https://example.com
  Identity        https://auth.example.com
  Observability   https://example.com/grafana/

  Administrator login
    E-mail (login name):  du@example.com
    Password:              <generiert> (also in .env, ZITADEL_ADMIN_PASSWORD)
    A password change is required on first login.
```

Du musst kein Konto registrieren und die Zitadel-Konsole nicht öffnen. Die
Administrator-E-Mail ist bereits verifiziert, es wird keine Mail verschickt.

## Schritt 6: Prüfen

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
* [Der lokalen Root-CA vertrauen](../how-to/trust-local-root-ca.md) — für die Strategie mit lokaler CA
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
