---
title: "Grafana-Zugriff gewähren"
description: "Einem Zitadel-Nutzer Zugriff auf Grafana geben, indem die Projektrolle alfheim_operator zugewiesen wird."
sidebar:
  label: "Grafana-Zugriff"
---

Die Grafana-Anmeldung über Zitadel ist auf Betreiber beschränkt. Ein Nutzer
kommt nur hinein, wenn sein Token die Zitadel-Projektrolle `alfheim_operator`
trägt; sie wird auf die Grafana-Rolle `Admin` abgebildet. Alle anderen Nutzer
werden beim Grafana-Login abgewiesen (strikte Rollenzuordnung), statt als Viewer
zugelassen zu werden.

Das lokale Grafana-Konto `admin` (`GRAFANA_ADMIN_USER` und
`GRAFANA_ADMIN_PASSWORD` in `.env`) ist davon nicht betroffen; damit kannst du
dir jederzeit wieder Zugriff verschaffen.

## Automatische Einrichtung

`alfheim-setup` legt bei der Installation und bei jedem `alfheim-setup update`
die Projektrolle `alfheim_operator` im Projekt **Alfheim** an, schaltet im
Projekt die Rollen-Assertion ein und weist die Rolle dem initialen
Administrator zu (dem Nutzer `ZITADEL_ADMIN_USER`). Bei einer bestehenden
Installation führt ein Fehler dabei nur zu einer Warnung, nie zu einem
abgebrochenen Update. Die folgenden manuellen Schritte brauchst du nur, wenn
diese Warnung erscheint oder um weiteren Nutzern Zugriff zu geben.

## Rolle anlegen (manuell, nur falls nötig)

1. Öffne die Zitadel-Konsole unter `https://<ZITADEL_EXTERNALDOMAIN>/ui/console`
   und melde dich als Instanz-Admin an (`ZITADEL_ADMIN_USER` in `.env`).
2. Wähle **Projects**, öffne das Projekt **Alfheim** und dort **Roles**.
3. Klicke **New**, setze den Key auf `alfheim_operator` (Anzeigename und Gruppe
   sind frei wählbar) und speichere.

## Rolle einem Nutzer zuweisen

1. Öffne im Projekt **Alfheim** den Reiter **Authorizations** und klicke **New**.
2. Wähle den Nutzer, bestätige das Projekt **Alfheim** und hake die Rolle
   `alfheim_operator` an.
3. Speichere. Der Nutzer meldet sich in Grafana ab und wieder an; die Rolle wird
   beim Login gelesen.

## So funktioniert es

- Grafana fordert den Scope `urn:zitadel:iam:org:project:roles` an, sodass
  Zitadel den Claim `urn:zitadel:iam:org:project:roles` (ein nach Rollen
  geschlüsseltes Objekt) in die Userinfo-Antwort aufnimmt.
- `GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_PATH` in `compose.prod.yaml` liefert
  `Admin`, wenn dieses Objekt `alfheim_operator` enthält, sonst einen leeren
  String; mit `GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_STRICT=true` lehnt ein leeres
  Ergebnis den Login ab.

## Fehlersuche

- **„Login failed“ oder „No valid role found“ direkt nach dem Zitadel-Login:**
  Der Nutzer hat noch keine `alfheim_operator`-Autorisierung, oder die
  Autorisierung liegt auf einem anderen Projekt als dem, zu dem der
  Grafana-Client gehört.
- **Rolle vergeben, aber weiterhin abgewiesen:** Melde dich auch in Zitadel ab
  und versuche es erneut, damit ein frisches Token ausgestellt wird.
