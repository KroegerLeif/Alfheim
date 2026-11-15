---
title: "E-Mail einrichten (SMTP)"
description: "Zitadel einen SMTP-Server geben, damit Passwort-Zurücksetzung, Einladungen und E-Mail-Verifizierung funktionieren, oder E-Mail wieder abschalten."
sidebar:
  label: "E-Mail (SMTP)"
---

Zitadel verschickt jede Anmelde-E-Mail selbst: Codes zum Zurücksetzen des
Passworts, Einladungen und Erstpasswörter für Benutzer, die du in der Konsole
anlegst, sowie Codes zur E-Mail-Verifizierung. Dafür braucht es einen
SMTP-Server. `alfheim-setup` richtet ihn für dich ein; in der Zitadel-Konsole
musst du nichts von Hand konfigurieren.

E-Mail ist optional und standardmäßig aus. Ohne E-Mail gilt:

* Passwort-Zurücksetzung, Einladungen und E-Mail-Verifizierung funktionieren
  nicht.
* Die Login-Seite blendet **Forgot password** aus, damit niemand auf einen Code
  wartet, der nie ankommt.
* Die Selbstregistrierung bleibt wie immer aus
  ([ADR 0008](../../en/explanation/decisions/0008-social-login-policy.md),
  englisch), kein Anmeldeablauf braucht also eine E-Mail. Vergib Benutzern ein
  Passwort in der Zitadel-Konsole.

Der Installer weist in seiner Zusammenfassung darauf hin. Mit aktivierter
E-Mail können Benutzer ihre Adresse verifizieren. Erst dadurch kann eine
Anmeldung über Google oder Apple ein bestehendes Konto anhand der verifizierten
E-Mail-Adresse verknüpfen (ADR 0008).

## Was du brauchst

* Einen SMTP-Server, der E-Mails von diesem Host annimmt: den
  Submission-Server deines Mail-Anbieters oder einen Dienst für
  Transaktions-E-Mails.
* Seinen Hostnamen und Port. Port `587` (STARTTLS) ist der Standard; `465`
  (implizites TLS) funktioniert ebenfalls.
* Benutzer und Passwort, außer der Server ist ein Relay ohne Authentifizierung.
* Eine Absenderadresse, unter der der Server senden darf, zum Beispiel
  `alfheim@example.com`.

## E-Mail einschalten

Bei einer neuen Installation im Schritt „e-mail (SMTP)" des Assistenten mit
**Yes** antworten oder die Werte headless übergeben:

```bash
export ALFHEIM_SMTP_PASSWORD='<SMTP-Passwort>'
alfheim-setup --non-interactive --domain example.com --tls internal \
  --admin-email ops@example.com \
  --smtp-host smtp.example.com --smtp-user alfheim \
  --smtp-sender-address alfheim@example.com
```

Für das Passwort gibt es absichtlich kein Flag: Der Wert eines Flags ist in der
Prozessliste sichtbar. Optionale Flags: `--smtp-port` (Standard `587`),
`--smtp-sender-name` (Standard `Alfheim`) und `--smtp-tls` (Standard `true`;
`false` nur für ein Relay auf demselben Host setzen, denn Zitadel verweigert,
ein Passwort über eine unverschlüsselte Verbindung an einen anderen Server zu
senden).

Bei einer bestehenden Installation die Werte in der `.env` setzen und den
Installer erneut ausführen:

```bash
# im Installationsverzeichnis
sed -i 's|^ALFHEIM_SMTP_HOST=.*|ALFHEIM_SMTP_HOST=smtp.example.com|' .env
sed -i 's|^ALFHEIM_SMTP_USER=.*|ALFHEIM_SMTP_USER=alfheim|' .env
sed -i 's|^ALFHEIM_SMTP_PASSWORD=.*|ALFHEIM_SMTP_PASSWORD=<SMTP-Passwort>|' .env
sed -i 's|^ALFHEIM_SMTP_SENDER_ADDRESS=.*|ALFHEIM_SMTP_SENDER_ADDRESS=alfheim@example.com|' .env
alfheim-setup
```

Ein einfacher erneuter Lauf (oder `alfheim-setup update`) gleicht Zitadel mit
der `.env` ab. Stammt deine `.env` aus der Zeit vor dieser Einstellung und hat
keine `ALFHEIM_SMTP_*`-Zeilen, hänge sie stattdessen an.

Der Provisioning-Schritt gibt aus:

```text
E-mail (SMTP): mail server created and active.
```

Der Installer legt in Zitadel einen SMTP-Provider an (Beschreibung „Alfheim
installer (alfheim-setup)"), aktiviert ihn und blendet **Forgot password** auf
der Login-Seite wieder ein. Die `.env` hat Modus `0600`; das Passwort wird nie
ausgegeben.

## Prüfen

Abmelden, auf der Login-Seite **Forgot password** wählen und die E-Mail-Adresse
des Administrators eingeben. Der Code sollte innerhalb einer Minute ankommen.
Falls nicht, steht der SMTP-Fehler im Zitadel-Log (`docker logs alfheim_zitadel`).

## Lokal mit Mailpit testen

Der Entwicklungs-Stack enthält [Mailpit](https://mailpit.axllent.org/), das
jede E-Mail annimmt und in einer Weboberfläche anzeigt, statt sie zuzustellen.
Diese Werte in der `.env` des Repositorys setzen und `./scripts/up.sh`
ausführen:

```dotenv
ALFHEIM_SMTP_HOST=mailpit
ALFHEIM_SMTP_PORT=1025
ALFHEIM_SMTP_TLS=false
ALFHEIM_SMTP_SENDER_ADDRESS=alfheim@alfheim.test
```

`up.sh` startet Mailpit, das Provisioning aktiviert es in Zitadel, und die
E-Mails erscheinen unter <http://127.0.0.1:8025>. `./scripts/verify-stack.sh`
legt dann einen Wegwerf-Benutzer an, fordert für ihn eine
Passwort-Zurücksetzung an, wartet auf die E-Mail in Mailpit und löscht beides
wieder.

## Einen Wert oder das Passwort ändern

In der `.env` ändern und `alfheim-setup` erneut ausführen. Der Installer
speichert einen Hash der konfigurierten Werte in `ZITADEL_SMTP_FINGERPRINT`,
erkennt die Änderung und aktualisiert den Provider. Ein Lauf ohne Änderungen
fasst Zitadel nicht an.

## E-Mail abschalten

Die `ALFHEIM_SMTP_*`-Werte in der `.env` leeren (oder mit `--reconfigure` im
E-Mail-Schritt des Assistenten **No** antworten) und `alfheim-setup` erneut
ausführen. Der Installer löscht seinen Provider samt gespeichertem Passwort und
blendet **Forgot password** wieder aus.

Einen E-Mail-Provider, den du selbst in der Zitadel-Konsole angelegt hast,
ändert der Installer nie. Solange einer aktiv ist, lässt er **Forgot password**
sichtbar und meldet, dass der Provider aus der Konsole verwendet wird.

## Fehlerbehebung

* **`ALFHEIM_SMTP_HOST is required ...`:** Ein anderer `ALFHEIM_SMTP_*`-Wert ist
  ohne Host gesetzt. Den Host setzen oder alle Werte leeren.
* **`... must be a bare host name ...`:** Den Port in `ALFHEIM_SMTP_PORT`
  eintragen, nicht in den Host.
* **`... go together`:** Benutzer und Passwort gemeinsam setzen, oder beide leer
  lassen für ein Relay.
* **`WARNING: the SMTP e-mail provider could not be configured`:** Bei einer
  bestehenden Installation ist ein Fehler nur eine Warnung, damit das Update
  trotzdem durchläuft. Zitadel lehnt eine Absenderadresse auf einer nicht
  verifizierten Domain ab, wenn seine Domain-Policy eine passende verlangt;
  die Ursache beheben und `alfheim-setup` erneut ausführen.
