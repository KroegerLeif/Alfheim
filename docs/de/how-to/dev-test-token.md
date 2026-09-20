---
title: "Dev-Test-Zugriffstoken generieren"
description: "OIDC Bearer Tokens für API-Tests im lokalen Dev-Stack ohne Browser-Interaktion erstellen."
---

Verwende diese Anleitung, um Zugriffstoken in deiner lokalen Entwicklungsumgebung für direkte
Backend-API-Tests zu erstellen – ohne Browser oder Web-UI. Sie führt durch Zitadels JWT-Profile-Flow
für einen Machine (Service-Account) User – den einzigen Grant, der ein Token mit der Project
Audience liefert, die jedes Alfheim-Backend verlangt.

---

## Voraussetzungen

- Lokaler Dev-Stack läuft (`./scripts/up.sh`)
- `curl`, `jq` und `openssl` (alle drei werden zum Erstellen und Signieren der JWT-Assertion
  verwendet – keine Node.js- oder andere JWT-Bibliothek nötig)

---

## Schritt 1: Einen Zitadel-Machine-User erstellen

Machine Users sind Service-Konten, die sich ohne Browser-Interaktion authentifizieren können.
Erstelle einen mit dem Bootstrap Personal Access Token (Zitadels Management API v1, dieselbe API,
die `alfheim-setup provision` verwendet).

```bash
# Bootstrap-PAT und Issuer aus der .env lesen
BOOTSTRAP_PAT=$(grep '^ZITADEL_BOOTSTRAP_PAT=' .env | cut -d= -f2-)
ZITADEL_ISSUER=${OIDC_ISSUER_URL:-http://auth.alfheim.loegien.localhost}
OIDC_AUDIENCE=$(grep '^OIDC_AUDIENCE=' .env | cut -d= -f2-)

USER_ID=$(curl -sf -X POST "${ZITADEL_ISSUER}/management/v1/users/machine" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" \
  -H "Content-Type: application/json" \
  -d '{"userName": "dev-test-token", "name": "Dev Test Token", "description": "Local API testing"}' \
  | jq -r '.userId')

echo "Machine-User-ID: ${USER_ID}"
```

Falls das `null` oder einen Fehler zurückgibt, gib die rohe Antwort aus (`| jq -r '.userId'`
weglassen) – ein `409` bedeutet, dass bereits ein User namens `dev-test-token` existiert;
verwende ihn weiter oder lösche ihn zuerst in der Zitadel-Konsole.

---

## Schritt 2: Einen JSON-Key für den Machine User erstellen

Der JWT-Profile-Grant signiert seine Assertion mit einem RSA-Key, den Zitadel generiert und
einmalig zurückgibt.

```bash
KEY_RESPONSE=$(curl -sf -X POST "${ZITADEL_ISSUER}/management/v1/users/${USER_ID}/keys" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" \
  -H "Content-Type: application/json" \
  -d '{"type": "KEY_TYPE_JSON", "expirationDate": "2099-01-01T00:00:00.000Z"}')

# keyDetails ist die base64-kodierte Machine-Key-JSON-Datei, die Zitadel sonst zum Download anbietet.
echo "${KEY_RESPONSE}" | jq -r '.keyDetails' | base64 -d > machine_key.json

KEY_ID=$(jq -r '.keyId' machine_key.json)
jq -r '.key' machine_key.json > machine_key.pem
chmod 600 machine_key.json machine_key.pem
```

`machine_key.pem` ist ein Private Key – lösche beide Dateien, sobald du fertig getestet hast
(`rm machine_key.json machine_key.pem`).

---

## Schritt 3: Die JWT-Assertion bauen und signieren

Zitadels JWT-Profile erwartet einen kurzlebigen, selbstsignierten JWT, bei dem sowohl `iss` als
auch `sub` die ID des Machine Users sind und `aud` der Issuer ist – kein bibliotheksunabhängiges
OIDC-ID-Token. `openssl` signiert direkt; keine JWT-Bibliothek nötig.

```bash
b64url() { openssl base64 -e -A | tr '+/' '-_' | tr -d '='; }

NOW=$(date +%s)
EXP=$((NOW + 3600))

HEADER=$(printf '{"alg":"RS256","kid":"%s","typ":"JWT"}' "${KEY_ID}" | b64url)
PAYLOAD=$(printf '{"iss":"%s","sub":"%s","aud":"%s","iat":%d,"exp":%d}' \
  "${USER_ID}" "${USER_ID}" "${ZITADEL_ISSUER}" "${NOW}" "${EXP}" | b64url)

SIGNING_INPUT="${HEADER}.${PAYLOAD}"
SIGNATURE=$(printf '%s' "${SIGNING_INPUT}" | openssl dgst -sha256 -sign machine_key.pem | b64url)

JWT="${SIGNING_INPUT}.${SIGNATURE}"
```

---

## Schritt 4: Den JWT gegen ein Zugriffstoken tauschen

Löse den Token-Endpoint über OIDC Discovery auf, statt ihn fest zu kodieren – dasselbe Muster,
das jedes Alfheim-Backend zum Auffinden der Issuer-Endpunkte verwendet.

```bash
TOKEN_ENDPOINT=$(curl -sf "${ZITADEL_ISSUER}/.well-known/openid-configuration" | jq -r '.token_endpoint')

TOKEN_RESPONSE=$(curl -sf -X POST "${TOKEN_ENDPOINT}" \
  --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
  --data-urlencode "assertion=${JWT}" \
  --data-urlencode "scope=openid urn:zitadel:iam:org:project:id:${OIDC_AUDIENCE}:aud")

ACCESS_TOKEN=$(echo "${TOKEN_RESPONSE}" | jq -r '.access_token')
echo "Token: ${ACCESS_TOKEN}"
```

**Wichtig:** Der Client-Credentials-Grant (`grant_type=client_credentials`) beinhaltet **nicht**
den Project-Audience-Scope, und Backends lehnen solche Token mit `401` ab. Verwende für Dev-Tests
immer den obigen JWT-Bearer-Grant.

---

## Schritt 5: Eine API mit dem Token aufrufen

```bash
ALFHEIM_BASE_URL=${ALFHEIM_BASE_URL:-http://alfheim.loegien.localhost}
HOUSEHOLD_ID="<deine Household-UUID>"

curl -X GET "${ALFHEIM_BASE_URL}/api/v1/profile/me" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "X-Household-ID: ${HOUSEHOLD_ID}" \
  -H "Content-Type: application/json" | jq .
```

Für Household-bezogene Endpoints immer einbeziehen:
- `Authorization: Bearer <token>`
- `X-Household-ID: <uuid>` (ein Household, in dem dieser User tatsächlich Mitglied ist – tritt
  zuerst einmal mit diesem Token über die `/household`-UI einem bei oder erstelle eines, oder
  nutze die Household-API)

---

## Schnell-Script

Fasst die Schritte 1–4 in einem kopierbaren Script zusammen. Führe es vom Repository-Root mit
laufendem Dev-Stack aus.

```bash
#!/bin/bash
set -euo pipefail

BOOTSTRAP_PAT=$(grep '^ZITADEL_BOOTSTRAP_PAT=' .env | cut -d= -f2-)
ZITADEL_ISSUER=${OIDC_ISSUER_URL:-http://auth.alfheim.loegien.localhost}
OIDC_AUDIENCE=$(grep '^OIDC_AUDIENCE=' .env | cut -d= -f2-)

b64url() { openssl base64 -e -A | tr '+/' '-_' | tr -d '='; }

WORKDIR=$(mktemp -d)
trap 'rm -rf "${WORKDIR}"' EXIT

# 1. Machine User
USER_ID=$(curl -sf -X POST "${ZITADEL_ISSUER}/management/v1/users/machine" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" -H "Content-Type: application/json" \
  -d '{"userName": "dev-test-'"$(date +%s)"'", "name": "Dev Test Token"}' | jq -r '.userId')

# 2. Machine Key
curl -sf -X POST "${ZITADEL_ISSUER}/management/v1/users/${USER_ID}/keys" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" -H "Content-Type: application/json" \
  -d '{"type": "KEY_TYPE_JSON", "expirationDate": "2099-01-01T00:00:00.000Z"}' \
  | jq -r '.keyDetails' | base64 -d > "${WORKDIR}/machine_key.json"
KEY_ID=$(jq -r '.keyId' "${WORKDIR}/machine_key.json")
jq -r '.key' "${WORKDIR}/machine_key.json" > "${WORKDIR}/machine_key.pem"

# 3. JWT-Assertion signieren
NOW=$(date +%s)
HEADER=$(printf '{"alg":"RS256","kid":"%s","typ":"JWT"}' "${KEY_ID}" | b64url)
PAYLOAD=$(printf '{"iss":"%s","sub":"%s","aud":"%s","iat":%d,"exp":%d}' \
  "${USER_ID}" "${USER_ID}" "${ZITADEL_ISSUER}" "${NOW}" "$((NOW + 3600))" | b64url)
SIGNING_INPUT="${HEADER}.${PAYLOAD}"
SIGNATURE=$(printf '%s' "${SIGNING_INPUT}" | openssl dgst -sha256 -sign "${WORKDIR}/machine_key.pem" | b64url)
JWT="${SIGNING_INPUT}.${SIGNATURE}"

# 4. Gegen ein Zugriffstoken tauschen
TOKEN_ENDPOINT=$(curl -sf "${ZITADEL_ISSUER}/.well-known/openid-configuration" | jq -r '.token_endpoint')
ACCESS_TOKEN=$(curl -sf -X POST "${TOKEN_ENDPOINT}" \
  --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
  --data-urlencode "assertion=${JWT}" \
  --data-urlencode "scope=openid urn:zitadel:iam:org:project:id:${OIDC_AUDIENCE}:aud" \
  | jq -r '.access_token')

echo "Machine-User-ID: ${USER_ID}"
echo "Zugriffstoken: ${ACCESS_TOKEN}"
```

---

## Fehlerbehebung

- **401 bei den Machine-User- oder Key-Aufrufen**: der Bootstrap-PAT fehlt oder ist abgelaufen.
  Führe `./scripts/up.sh` erneut aus, um ihn zu erneuern, oder lies ihn erneut aus der `.env`.
- **`invalid_scope` oder `invalid_grant` vom Token-Endpoint**: stelle sicher, dass
  `OIDC_AUDIENCE` gesetzt ist (sie enthält die Zitadel-*Projekt-ID*, nicht den literalen String
  `alfheim`) und dass der Scope exakt `openid urn:zitadel:iam:org:project:id:<OIDC_AUDIENCE>:aud`
  lautet.
- **`invalid_client` / Signaturfehler vom Token-Endpoint**: das `kid` des JWT muss exakt der
  `keyId` aus Schritt 2 entsprechen, und `machine_key.pem` muss das unveränderte `key`-Feld aus
  den dekodierten `keyDetails` sein (inklusive abschließendem Zeilenumbruch).
- **Zitadel-API-Form weicht von der hier dokumentierten ab**: Antworten der Management API können
  sich zwischen Zitadel-Versionen ändern. Gib die rohe JSON-Antwort jedes `curl`-Aufrufs aus (den
  `jq`-Filter weglassen), um die tatsächlichen Feldnamen zu sehen, bevor du das Script anpasst.
- **`X-Household-ID` erforderlich (`400 household_required`)**: Household-bezogene Endpoints
  benötigen diesen Header. Tritt zuerst mit diesem Token einem Household bei oder erstelle eines,
  oder nutze die UUID eines bestehenden Households, in dem dieser User Mitglied ist.
