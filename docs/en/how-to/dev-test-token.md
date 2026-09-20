---
title: "Get a Dev Test Access Token"
description: "Generate OIDC bearer tokens for API testing in the local dev stack without a browser."
---

Use this guide to mint access tokens in your local development environment for testing backend
APIs directly, without opening a browser or using the web UI. It walks through Zitadel's JWT
profile flow for a machine (service account) user — the only grant that produces a token
carrying the project audience every Alfheim backend requires.

---

## Prerequisites

- Local dev stack running (`./scripts/up.sh`)
- `curl`, `jq` and `openssl` (all three are used to build and sign the JWT assertion — no Node.js
  or other JWT library is required)

---

## Step 1: Create a Zitadel Machine User

Machine users are service accounts that can authenticate without browser interaction. Create one
using the bootstrap personal access token (Zitadel's Management API v1, the same API
`alfheim-setup provision` uses).

```bash
# Read the bootstrap PAT and issuer from your .env
BOOTSTRAP_PAT=$(grep '^ZITADEL_BOOTSTRAP_PAT=' .env | cut -d= -f2-)
ZITADEL_ISSUER=${OIDC_ISSUER_URL:-http://auth.alfheim.loegien.localhost}
OIDC_AUDIENCE=$(grep '^OIDC_AUDIENCE=' .env | cut -d= -f2-)

USER_ID=$(curl -sf -X POST "${ZITADEL_ISSUER}/management/v1/users/machine" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" \
  -H "Content-Type: application/json" \
  -d '{"userName": "dev-test-token", "name": "Dev Test Token", "description": "Local API testing"}' \
  | jq -r '.userId')

echo "Machine user id: ${USER_ID}"
```

If this returns `null` or an error, print the raw response (drop `| jq -r '.userId'`) — a `409`
means a user named `dev-test-token` already exists; either reuse it or delete it first in the
Zitadel console.

---

## Step 2: Create a JSON Key for the Machine User

The JWT profile grant signs its assertion with an RSA key Zitadel generates and hands back once.

```bash
KEY_RESPONSE=$(curl -sf -X POST "${ZITADEL_ISSUER}/management/v1/users/${USER_ID}/keys" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" \
  -H "Content-Type: application/json" \
  -d '{"type": "KEY_TYPE_JSON", "expirationDate": "2099-01-01T00:00:00.000Z"}')

# keyDetails is the base64-encoded machine-key JSON file Zitadel would otherwise let you download.
echo "${KEY_RESPONSE}" | jq -r '.keyDetails' | base64 -d > machine_key.json

KEY_ID=$(jq -r '.keyId' machine_key.json)
jq -r '.key' machine_key.json > machine_key.pem
chmod 600 machine_key.json machine_key.pem
```

`machine_key.pem` is a private key — delete both files when you are done testing
(`rm machine_key.json machine_key.pem`).

---

## Step 3: Build and Sign the JWT Assertion

Zitadel's JWT profile expects a short-lived, self-signed JWT where both `iss` and `sub` are the
machine user's id and `aud` is the issuer — not a library-agnostic OIDC id token. `openssl` signs
it directly; no JWT library is needed.

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

## Step 4: Exchange the JWT for an Access Token

Resolve the token endpoint from OIDC discovery rather than hardcoding it — the same pattern every
Alfheim backend uses to find the issuer's endpoints.

```bash
TOKEN_ENDPOINT=$(curl -sf "${ZITADEL_ISSUER}/.well-known/openid-configuration" | jq -r '.token_endpoint')

TOKEN_RESPONSE=$(curl -sf -X POST "${TOKEN_ENDPOINT}" \
  --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
  --data-urlencode "assertion=${JWT}" \
  --data-urlencode "scope=openid urn:zitadel:iam:org:project:id:${OIDC_AUDIENCE}:aud")

ACCESS_TOKEN=$(echo "${TOKEN_RESPONSE}" | jq -r '.access_token')
echo "Token: ${ACCESS_TOKEN}"
```

**Important:** the client-credentials grant (`grant_type=client_credentials`) does **not** include
the project audience scope, and backends reject those tokens with a `401`. Always use the
JWT-bearer grant above for dev testing.

---

## Step 5: Call an API with the Token

```bash
ALFHEIM_BASE_URL=${ALFHEIM_BASE_URL:-http://alfheim.loegien.localhost}
HOUSEHOLD_ID="<your household UUID>"

curl -X GET "${ALFHEIM_BASE_URL}/api/v1/profile/me" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "X-Household-ID: ${HOUSEHOLD_ID}" \
  -H "Content-Type: application/json" | jq .
```

For household-scoped endpoints, always include:
- `Authorization: Bearer <token>`
- `X-Household-ID: <uuid>` (a household this user is actually a member of — join or create one
  once through the `/household` UI with this token first, or via the household API)

---

## Quick Script

Combines steps 1-4 into one copy-pasteable script. Run it from the repository root with the dev
stack up.

```bash
#!/bin/bash
set -euo pipefail

BOOTSTRAP_PAT=$(grep '^ZITADEL_BOOTSTRAP_PAT=' .env | cut -d= -f2-)
ZITADEL_ISSUER=${OIDC_ISSUER_URL:-http://auth.alfheim.loegien.localhost}
OIDC_AUDIENCE=$(grep '^OIDC_AUDIENCE=' .env | cut -d= -f2-)

b64url() { openssl base64 -e -A | tr '+/' '-_' | tr -d '='; }

WORKDIR=$(mktemp -d)
trap 'rm -rf "${WORKDIR}"' EXIT

# 1. Machine user
USER_ID=$(curl -sf -X POST "${ZITADEL_ISSUER}/management/v1/users/machine" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" -H "Content-Type: application/json" \
  -d '{"userName": "dev-test-'"$(date +%s)"'", "name": "Dev Test Token"}' | jq -r '.userId')

# 2. Machine key
curl -sf -X POST "${ZITADEL_ISSUER}/management/v1/users/${USER_ID}/keys" \
  -H "Authorization: Bearer ${BOOTSTRAP_PAT}" -H "Content-Type: application/json" \
  -d '{"type": "KEY_TYPE_JSON", "expirationDate": "2099-01-01T00:00:00.000Z"}' \
  | jq -r '.keyDetails' | base64 -d > "${WORKDIR}/machine_key.json"
KEY_ID=$(jq -r '.keyId' "${WORKDIR}/machine_key.json")
jq -r '.key' "${WORKDIR}/machine_key.json" > "${WORKDIR}/machine_key.pem"

# 3. Sign the JWT assertion
NOW=$(date +%s)
HEADER=$(printf '{"alg":"RS256","kid":"%s","typ":"JWT"}' "${KEY_ID}" | b64url)
PAYLOAD=$(printf '{"iss":"%s","sub":"%s","aud":"%s","iat":%d,"exp":%d}' \
  "${USER_ID}" "${USER_ID}" "${ZITADEL_ISSUER}" "${NOW}" "$((NOW + 3600))" | b64url)
SIGNING_INPUT="${HEADER}.${PAYLOAD}"
SIGNATURE=$(printf '%s' "${SIGNING_INPUT}" | openssl dgst -sha256 -sign "${WORKDIR}/machine_key.pem" | b64url)
JWT="${SIGNING_INPUT}.${SIGNATURE}"

# 4. Exchange for an access token
TOKEN_ENDPOINT=$(curl -sf "${ZITADEL_ISSUER}/.well-known/openid-configuration" | jq -r '.token_endpoint')
ACCESS_TOKEN=$(curl -sf -X POST "${TOKEN_ENDPOINT}" \
  --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
  --data-urlencode "assertion=${JWT}" \
  --data-urlencode "scope=openid urn:zitadel:iam:org:project:id:${OIDC_AUDIENCE}:aud" \
  | jq -r '.access_token')

echo "Machine user id: ${USER_ID}"
echo "Access token: ${ACCESS_TOKEN}"
```

---

## Troubleshooting

- **401 on the machine-user or key creation calls**: the bootstrap PAT is missing or expired.
  Re-run `./scripts/up.sh` to refresh it, or re-read it from `.env`.
- **`invalid_scope` or `invalid_grant` from the token endpoint**: confirm `OIDC_AUDIENCE` is set
  (it holds the Zitadel *project id*, not the literal string `alfheim`) and that the scope reads
  exactly `openid urn:zitadel:iam:org:project:id:<OIDC_AUDIENCE>:aud`.
- **`invalid_client` / signature errors from the token endpoint**: the JWT's `kid` must match the
  `keyId` from Step 2 exactly, and `machine_key.pem` must be the untouched `key` field from the
  decoded `keyDetails` (including its trailing newline).
- **Zitadel API shape differs from what's documented here**: Management API responses can change
  between Zitadel versions. Print the raw JSON from each `curl` call (drop the `jq` filter) to see
  the actual field names before adjusting the script.
- **`X-Household-ID` required (`400 household_required`)**: household-scoped endpoints need this
  header. Join or create a household with this token first, or use the UUID of an existing one
  this user belongs to.
