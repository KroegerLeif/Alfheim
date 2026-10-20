---
title: "Grant Grafana access"
description: "Give a Zitadel user access to Grafana by assigning the alfheim_operator project role."
sidebar:
  label: "Grafana access"
---

Grafana sign-in through Zitadel is restricted to operators. A user is let in
only if their token carries the Zitadel project role `alfheim_operator`; the
role is mapped to the Grafana `Admin` role. Every other user is denied at the
Grafana login (strict role mapping), instead of being admitted as a viewer.

The local Grafana `admin` account (`GRAFANA_ADMIN_USER` and
`GRAFANA_ADMIN_PASSWORD` in `.env`) is unaffected, so you can always sign in
with it to recover access.

## Automatic setup

`alfheim-setup` creates the project role `alfheim_operator` on the **Alfheim**
project on install and on every `alfheim-setup update`, turns on role assertion
for the project and grants the role to the initial administrator (the user
`ZITADEL_ADMIN_USER`). On an existing installation a failure here only prints a
warning and never aborts the update. You only need the manual steps below when
that warning appears, or to give further users access.

## Create the role (manually, only if needed)

1. Open the Zitadel console at `https://<ZITADEL_EXTERNALDOMAIN>/ui/console`
   and sign in as the instance admin (`ZITADEL_ADMIN_USER` in `.env`).
2. Go to **Projects**, open the **Alfheim** project and select **Roles**.
3. Click **New**, set the key to `alfheim_operator` (display name and group are
   free text) and save.

## Grant the role to a user

1. In the **Alfheim** project open **Authorizations** and click **New**.
2. Select the user, confirm the project **Alfheim** and tick the role
   `alfheim_operator`.
3. Save. The user signs out of Grafana and in again; the role is read at login.

## How it works

- Grafana requests the scope `urn:zitadel:iam:org:project:roles`, so Zitadel
  adds the claim `urn:zitadel:iam:org:project:roles` (an object keyed by role)
  to the userinfo response.
- `GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_PATH` in `compose.prod.yaml` returns
  `Admin` when that object contains `alfheim_operator` and an empty string
  otherwise; with `GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_STRICT=true` an empty
  result rejects the login.

## Troubleshooting

- **"Login failed" or "No valid role found" right after Zitadel login:** the
  user has no `alfheim_operator` authorization yet, or the authorization is on a
  different project than the one the Grafana client belongs to.
- **Role granted but still denied:** sign out of Zitadel as well, then retry so
  a fresh token is issued.
