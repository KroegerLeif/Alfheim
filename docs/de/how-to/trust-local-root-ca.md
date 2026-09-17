---
title: "Der lokalen Root-CA vertrauen"
description: "Browser und Geräte der Root-CA vertrauen lassen, die alfheim-setup für die TLS-Strategie internal erzeugt, oder stattdessen die Warnung für beide Hosts akzeptieren."
sidebar:
  label: "Lokaler Root-CA vertrauen"
---

Diese Anleitung gilt nach einer Installation mit der TLS-Strategie `internal`
(`--tls internal` oder *Local CA (self-signed HTTPS)* im Assistenten),
einschließlich des LAN-Presets `.localhost`.

## Warum das nötig ist

Die Anmeldung in Alfheim nutzt PKCE. Dafür braucht es Web Crypto, und das geben
Browser nur über HTTPS frei. Die Strategie `internal` liefert deshalb jeden Host
über HTTPS aus, mit Zertifikaten, die eine vom Installer für diese Installation
erzeugte Root-CA signiert. Kein Browser und kein Betriebssystem vertraut dieser
Root von sich aus, deshalb zeigt der erste Aufruf eine Zertifikatswarnung.

Browser speichern Zertifikatsausnahmen **pro Host**. Eine akzeptierte Warnung
für den App-Host gilt nicht für den Auth-Host, und die Hintergrundanfrage des
Logins an den Auth-Host wird ohne Rückfrage abgelehnt. Das Dashboard zeigt dann
*Sign-in service not reachable* mit einem Link zum Auth-Host.

Einmal importiert, behebt die Root das für jeden Alfheim-Host auf diesem Gerät.

## Bevor du beginnst

Der Installer schreibt zwei Dateien:

| Datei | Inhalt | Weitergeben? |
| :--- | :--- | :--- |
| `infrastructure/ca/alfheim-root-ca.crt` | Öffentliches Root-Zertifikat | Ja, diese Datei importierst du |
| `infrastructure/caddy/pki/root.key` | Privater Schlüssel der Root (Modus `0600`) | **Niemals.** Wer ihn hat, kann Zertifikate ausstellen, denen deine Geräte vertrauen |

Die Root heißt *Alfheim Local Root CA (&lt;deine Domain&gt;)*, ist zehn Jahre
gültig und wird nie stillschweigend ersetzt: `--reconfigure` und Updates
verwenden sie weiter.

## Schritt 1: Fingerprint prüfen

Kopiere `alfheim-root-ca.crt` auf das Gerät und vergleiche den
SHA-256-Fingerprint mit dem, den der Installer ausgegeben hat
(`Generated local root CA … (SHA-256 …)`):

```bash
openssl x509 -noout -fingerprint -sha256 -in infrastructure/ca/alfheim-root-ca.crt
```

Importiere die Datei nur, wenn beide Werte übereinstimmen.

## Schritt 2: Root importieren

Wähle den Speicher, den dein Browser tatsächlich liest.

* **macOS** (Safari, Chrome, Edge): *Schlüsselbundverwaltung* öffnen, die Datei
  in den Schlüsselbund *System* importieren, das Zertifikat öffnen und
  *Vertrauen* auf *Immer vertrauen* setzen.
* **Windows** (Chrome, Edge): `certmgr.msc` starten, *Vertrauenswürdige
  Stammzertifizierungsstellen → Zertifikate* öffnen, dann *Alle Aufgaben →
  Importieren*.
* **Linux, systemweit** (Debian/Ubuntu; genutzt von `curl` und den meisten
  Tools):

  ```bash
  sudo cp alfheim-root-ca.crt /usr/local/share/ca-certificates/
  sudo update-ca-certificates
  ```

  Chrome und Chromium unter Linux nutzen einen eigenen Speicher:
  *Einstellungen → Datenschutz und Sicherheit → Sicherheit → Zertifikate
  verwalten → Zertifizierungsstellen → Importieren*.
* **Firefox** (jedes Betriebssystem): *Einstellungen → Datenschutz & Sicherheit
  → Zertifikate → Zertifikate anzeigen → Zertifizierungsstellen → Importieren*,
  dann *Dieser CA vertrauen, um Websites zu identifizieren* anhaken.
* **Android**: *Einstellungen → Sicherheit → Verschlüsselung &
  Anmeldedaten → Zertifikat installieren → CA-Zertifikat*. Die Menünamen
  unterscheiden sich je nach Hersteller. Chrome nutzt diesen Speicher; Firefox
  für Android erst, nachdem in den geheimen Einstellungen *Use third party CA
  certificates* aktiviert wurde.
* **iOS / iPadOS**: Datei aufs Gerät schicken (AirDrop oder Mail), unter
  *Einstellungen → Allgemein → VPN und Geräteverwaltung* installieren und dann
  unter *Einstellungen → Allgemein → Info → Zertifikatsvertrauenseinstellungen*
  aktivieren.

Starte den Browser danach neu.

## Ausweichweg: Warnung für beide Hosts akzeptieren

Kannst du die Root nicht importieren, öffne vor der Anmeldung **beide** vom
Installer ausgegebenen Adressen und akzeptiere auf jeder die Zertifikatswarnung:

* `https://<App-Host>`, zum Beispiel `https://alfheim.example.lan`
* `https://<Auth-Host>`, zum Beispiel `https://auth.example.lan`

Ausnahmen können ablaufen oder mit den Browserdaten gelöscht werden; dann musst
du das wiederholen.

## Prüfen

Öffne das Dashboard und melde dich an. Die Adressleiste zeigt für keinen der
beiden Hosts eine Warnung, und der Login leitet ohne Fehler zum Auth-Host und
zurück.

## Fehlerbehebung

**Das Dashboard zeigt *Sign-in service not reachable*.**
Dem Zertifikat des Auth-Hosts wird noch nicht vertraut (oder Zitadel läuft
nicht). Folge dem Link auf der Seite, vertraue dem Zertifikat oder akzeptiere
es, und lade neu.

**Das Dashboard zeigt *Secure connection (HTTPS) required*.**
Du hast die App über `http://` geöffnet. Nutze den `https://`-Link auf der
Seite. Eine Installation aus der Zeit, als `internal` noch kein HTTPS
auslieferte, migriert mit `alfheim-setup --reconfigure`.

**Die Warnung bleibt nach dem Import.**
Prüfe, ob du in den Speicher importiert hast, den dein Browser liest (Firefox
und Chrome unter Linux haben eigene), und ob der Fingerprint zur aktuellen Root
passt.

## Siehe auch

* [Installer-CLI-Referenz](../reference/installer-cli.md)
* [Eigene TLS-Zertifikate verwenden](./custom-certificates.md)
* [Bekannte Probleme & System-Trade-offs](../explanation/known-issues.md)
