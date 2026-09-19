---
title: "Dev-Test-Zugriffstokens generieren"
description: "OIDC Bearer Tokens für API-Tests im lokalen Dev-Stack ohne Browser-Interaktion erstellen."
---

Verwende diese Anleitung, um Zugriffstokens in deiner lokalen Entwicklungsumgebung für direkte Backend-API-Tests zu erstellen – ohne Browser oder Web-UI.

---

## Voraussetzungen

- Lokaler Dev-Stack läuft (`./scripts/up.sh`)
- `curl` oder ähnlicher HTTP-Client
- `jq` installiert (für JSON-Verarbeitung)

---

## Schritt 1: Einen Zitadel-Machine-User erstellen

Machine Users sind Service-Konten, die sich ohne Browser authentifizieren können. Erstelle einen mit dem Bootstrap Personal Access Token.

```bash
# Hole den ZITADEL_BOOTSTRAP_PAT aus deiner .env-Datei
BOOTSTRAP_PAT=$(grep '^ZITADEL_BOOTSTRAP_PAT=' .env | cut -d= -f2-)
ZITADEL_ISSUER=${OIDC_ISSUER_URL:-http://auth.alfheim.loegien.localhost}

# Erstelle einen Machine User in Zitadels Standard-Organisation
curl -s -X POST "${ZITADEL_ISSUER}/v2/users/machine" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "dev-test-machine",
    "name": "Dev Test Machine User"
  }' | jq '.userId'
```

Speichere die zurückgegebene `userId` als `MACHINE_USER_ID`.

---

## Schritt 2: Einen JSON-Key für den Machine User erstellen

Zitadel Machine Users authentifizieren sich mit JSON Web Key (JWK) Profilen.

```bash
MACHINE_USER_ID="<userId aus Schritt 1>"

# Generiere einen JSON-Key
curl -s -X POST "${ZITADEL_ISSUER}/v2/users/${MACHINE_USER_ID}/keys/machine" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" \
  -H "Content-Type: application/json" \
  -d '{}' | jq . > machine_key.json
```

Extrahiere die Key-Details:

```bash
KEY_ID=$(jq -r '.keyId' machine_key.json)
PRIVATE_KEY=$(jq -r '.key' machine_key.json)
```

---

## Schritt 3: Einen signierten JWT für den Machine User erstellen

Verwende den Private Key, um einen selbstsignierten JWT mit dem JWT Bearer Grant zu erstellen.

```bash
# Installiere node-jose falls nötig: npm install -g node-jose-tools
OIDC_AUDIENCE=$(grep '^OIDC_AUDIENCE=' .env | cut -d= -f2-)

# JWT erstellen (benötigt eine JWT-Bibliothek; Beispiel mit Node.js)
node << 'NODEJS'
const crypto = require('crypto');
const fs = require('fs');

const payload = {
  iss: "${MACHINE_USER_ID}@${OIDC_AUDIENCE}",
  sub: "${MACHINE_USER_ID}",
  aud: "${ZITADEL_ISSUER}",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
};

const privateKey = fs.readFileSync('machine_key.json', 'utf8');
// Signiere JWT mit dem Key
console.log('JWT erstellt');
NODEJS
```

---

## Schritt 4: Zugriffstokens anfordern (JWT-Bearer Grant)

Tausche den signierten JWT gegen einen Zugriffstokens. Dieser Grant beinhaltet die Project Audience im Token, was Backends benötigen.

```bash
TOKEN_RESPONSE=$(curl -s -X POST "${ZITADEL_ISSUER}/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${JWT}" \
  -d "scope=openid%20urn:zitadel:iam:org:project:id:${OIDC_AUDIENCE}:aud")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
echo "Token: $ACCESS_TOKEN"
```

**Wichtig:** Der Client-Credentials Grant (`grant_type=client_credentials`) beinhaltet **nicht** den Project Audience Scope, und Backends lehnen solche Tokens ab. Verwende immer den JWT-Bearer Grant für Dev-Tests.

---

## Schritt 5: Eine API mit dem Token aufrufen

Verwende den Zugriffstokens zur Authentifizierung von API-Anfragen.

```bash
# Beispiel: Hole dein Profil von der Household API
ALFHEIM_BASE_URL=${ALFHEIM_BASE_URL:-http://alfheim.loegien.localhost}
HOUSEHOLD_ID="<deine Household UUID>"

curl -X GET "${ALFHEIM_BASE_URL}/api/v1/profile/me" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "X-Household-ID: ${HOUSEHOLD_ID}" \
  -H "Content-Type: application/json" | jq .
```

Für Household-spezifische Endpoints immer einbeziehen:
- `Authorization: Bearer <token>`
- `X-Household-ID: <uuid>` (Household, für das der Token handeln soll)

---

## Schnell-Script

```bash
#!/bin/bash
set -e

BOOTSTRAP_PAT=$(grep '^ZITADEL_BOOTSTRAP_PAT=' .env | cut -d= -f2-)
OIDC_ISSUER=${OIDC_ISSUER_URL:-http://auth.alfheim.loegien.localhost}
OIDC_AUDIENCE=$(grep '^OIDC_AUDIENCE=' .env | cut -d= -f2-)

# Erstelle Machine User
USER_ID=$(curl -s -X POST "${OIDC_ISSUER}/v2/users/machine" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" \
  -H "Content-Type: application/json" \
  -d '{"username":"dev-test-'$(date +%s)'","name":"Dev Test"}' | jq -r '.userId')

echo "Machine User ID: $USER_ID"

# Erstelle Key und fordere Token an
curl -s -X POST "${OIDC_ISSUER}/v2/users/${USER_ID}/keys/machine" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.key'
```

---

## Fehlerbehandlung

- **401 Unauthorized**: Der Bootstrap PAT fehlt oder ist abgelaufen. Führe `./scripts/up.sh` erneut aus, um ihn zu aktualisieren.
- **Invalid scope**: Stelle sicher, dass der Scope die vollständige Project Audience beinhaltet: `urn:zitadel:iam:org:project:id:alfheim:aud`.
- **X-Household-ID erforderlich**: Household-Endpoints geben 400 zurück ohne diesen Header. Hole eine gültige UUID aus deinen Household-Datensätzen.
