---
title: "Get a Dev Test Access Token"
description: "Generate OIDC bearer tokens for API testing in the local dev stack without a browser."
---

Use this guide to mint access tokens in your local development environment for testing backend APIs directly, without opening a browser or using the web UI.

---

## Prerequisites

- Local dev stack running (`./scripts/up.sh`)
- `curl` or similar HTTP client
- `jq` installed (for JSON parsing)

---

## Step 1: Create a Zitadel Machine User

Machine users are service accounts that can authenticate without browser interaction. Create one using the bootstrap personal access token.

```bash
# Get the ZITADEL_BOOTSTRAP_PAT from your .env file
BOOTSTRAP_PAT=$(grep '^ZITADEL_BOOTSTRAP_PAT=' .env | cut -d= -f2-)
ZITADEL_ISSUER=${OIDC_ISSUER_URL:-http://auth.alfheim.loegien.localhost}

# Create a machine user in Zitadel's default organization
curl -s -X POST "${ZITADEL_ISSUER}/v2/users/machine" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "dev-test-machine",
    "name": "Dev Test Machine User"
  }' | jq '.userId'
```

Save the returned `userId` as `MACHINE_USER_ID`.

---

## Step 2: Create a JSON Key for the Machine User

Zitadel machine users authenticate using JSON Web Key (JWK) profiles.

```bash
MACHINE_USER_ID="<userId from step 1>"

# Generate a JSON key
curl -s -X POST "${ZITADEL_ISSUER}/v2/users/${MACHINE_USER_ID}/keys/machine" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" \
  -H "Content-Type: application/json" \
  -d '{}' | jq . > machine_key.json
```

Extract the key details:

```bash
KEY_ID=$(jq -r '.keyId' machine_key.json)
PRIVATE_KEY=$(jq -r '.key' machine_key.json)
```

---

## Step 3: Create a Signed JWT for the Machine User

Use the private key to create a self-signed JWT with the JWT Bearer grant.

```bash
# Install node-jose if needed: npm install -g node-jose-tools
OIDC_AUDIENCE=$(grep '^OIDC_AUDIENCE=' .env | cut -d= -f2-)

# Create JWT (requires a JWT library; example using bash + jq)
# For testing, use an online JWT tool or Node.js:
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
// Sign JWT using the key
console.log('JWT created');
NODEJS
```

---

## Step 4: Request an Access Token (JWT-Bearer Grant)

Exchange the signed JWT for an access token. This grant includes the project audience in the token, which backends require.

```bash
TOKEN_RESPONSE=$(curl -s -X POST "${ZITADEL_ISSUER}/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${JWT}" \
  -d "scope=openid%20urn:zitadel:iam:org:project:id:${OIDC_AUDIENCE}:aud")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
echo "Token: $ACCESS_TOKEN"
```

**Important:** The client-credentials grant (`grant_type=client_credentials`) does **not** include the project audience scope, and backends will reject those tokens. Always use the JWT-bearer grant for dev testing.

---

## Step 5: Call an API with the Token

Use the access token to authenticate API requests.

```bash
# Example: fetch your profile from the household API
ALFHEIM_BASE_URL=${ALFHEIM_BASE_URL:-http://alfheim.loegien.localhost}
HOUSEHOLD_ID="<your household UUID>"

curl -X GET "${ALFHEIM_BASE_URL}/api/v1/profile/me" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "X-Household-ID: ${HOUSEHOLD_ID}" \
  -H "Content-Type: application/json" | jq .
```

For household-specific endpoints, always include:
- `Authorization: Bearer <token>`
- `X-Household-ID: <uuid>` (household the token should act on)

---

## Quick Script

```bash
#!/bin/bash
set -e

BOOTSTRAP_PAT=$(grep '^ZITADEL_BOOTSTRAP_PAT=' .env | cut -d= -f2-)
OIDC_ISSUER=${OIDC_ISSUER_URL:-http://auth.alfheim.loegien.localhost}
OIDC_AUDIENCE=$(grep '^OIDC_AUDIENCE=' .env | cut -d= -f2-)

# Create machine user
USER_ID=$(curl -s -X POST "${OIDC_ISSUER}/v2/users/machine" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" \
  -H "Content-Type: application/json" \
  -d '{"username":"dev-test-'$(date +%s)'","name":"Dev Test"}' | jq -r '.userId')

echo "Machine User ID: $USER_ID"

# Create key and request token
curl -s -X POST "${OIDC_ISSUER}/v2/users/${USER_ID}/keys/machine" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.key'
```

---

## Troubleshooting

- **401 Unauthorized**: The bootstrap PAT is missing or expired. Re-run `./scripts/up.sh` to refresh.
- **Invalid scope**: Make sure the scope includes the full project audience: `urn:zitadel:iam:org:project:id:alfheim:aud`.
- **X-Household-ID required**: Household endpoints return 400 without this header. Get a valid UUID from your household records.
