---
title: "Set up social login"
description: "Add Sign in with Google or Sign in with Apple to the Zitadel login page of an Alfheim installation, or take it off again."
sidebar:
  label: "Social login"
---

Social login adds "Sign in with Google" and "Sign in with Apple" buttons to the
Zitadel login page. Each is off by default and independent of the other. `alfheim-setup` turns it on when you supply the provider's
credentials; you never configure the identity provider in the Zitadel console by
hand.

What happens at the first sign-in is decided in
[ADR 0008](../explanation/decisions/0008-social-login-policy.md):

* A person without an Alfheim account gets one just in time and starts without a
  household (onboarding asks them to accept an invitation or create one).
* A person whose **verified** e-mail matches an existing account is linked to it.
* Local username/password registration stays off.
* Linking needs a verified e-mail on the Zitadel side. For an account you create
  in the console, either mark the address as verified there or let the user
  verify it by e-mail, which needs [SMTP](configure-smtp.md).

> **Your instance becomes open.** Anyone with an account at the provider who can
> reach your instance can sign in and create their own household. They cannot see
> other households. To keep the instance closed, restrict the audience at the
> provider (Google: see below). Apple has no such restriction: do not enable
> Apple on an instance that must stay closed.

## Google

### 1. Create the OAuth client

1. In the [Google Cloud console](https://console.cloud.google.com/), select or
   create a project.
2. Open **APIs & Services → OAuth consent screen** and configure it. To keep the
   instance closed, choose **Internal** (Google Workspace only) or keep the app in
   **Testing** and list the allowed accounts under **Test users**.
3. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   type **Web application**.
4. Under **Authorized redirect URIs**, add the Zitadel callback on your auth host:

   ```text
   https://auth.<your domain>/ui/login/login/externalidp/callback
   ```

   The installer prints the exact value after provisioning, so you can also add it
   once you have run step 2 below.
5. Copy the client ID and the client secret.

### 2. Give the credentials to the installer

On a new installation, answer **Yes** at the wizard's "external sign-in" step, or
pass them headless:

```bash
export ALFHEIM_GOOGLE_CLIENT_SECRET='<client secret>'
alfheim-setup --non-interactive --domain example.com --tls internal \
  --admin-email ops@example.com --google-client-id '<client id>'
```

The secret has no flag on purpose: a flag value is visible in the process list.

On an existing installation, set both values in `.env` and apply them:

```bash
# in the installation root
sed -i 's|^ALFHEIM_GOOGLE_CLIENT_ID=.*|ALFHEIM_GOOGLE_CLIENT_ID=<client id>|' .env
sed -i 's|^ALFHEIM_GOOGLE_CLIENT_SECRET=.*|ALFHEIM_GOOGLE_CLIENT_SECRET=<client secret>|' .env
alfheim-setup
```

A plain re-run (or `alfheim-setup update`) reconciles Zitadel from `.env`. If
your `.env` predates social login and has no such lines, append them instead.

The provisioning step prints a line like:

```text
Social login: google sign-in created. Redirect URI for Google (...):
    https://auth.example.com/ui/login/login/externalidp/callback
```

Register that URI at Google if you have not already. The secret is never printed.

### 3. Check it

Open the dashboard, sign out, and sign in again: the Zitadel login page shows
**Google**. Sign in with a Google account whose e-mail matches your administrator
account to link it, or with a new account to see the onboarding.

## Apple

Sign in with Apple needs a paid Apple Developer account. Apple differs from
Google in three ways: the client secret is a short-lived JWT that Zitadel signs
with your private key, Apple answers with a form POST, and users may hide their
e-mail behind a relay address.

### 1. Create the identifiers and the key

In the [Apple developer portal](https://developer.apple.com/account/resources/)
under **Certificates, Identifiers & Profiles**:

1. **Identifiers → App IDs:** create (or reuse) an App ID with the **Sign in with
   Apple** capability.
2. **Identifiers → Services IDs:** create a Services ID, for example
   `com.example.alfheim.signin`. This is the client ID. Enable **Sign in with
   Apple**, choose the App ID as primary, and under **Website URLs** add:
   * **Domains:** `auth.<your domain>`
   * **Return URLs:** `https://auth.<your domain>/ui/login/login/externalidp/callback/form`
3. **Keys:** create a key with **Sign in with Apple** for the App ID and
   download the `.p8` file (Apple offers the download only once). Note its
   **Key ID** and your **Team ID** (top right of the portal); both have 10
   characters.

### 2. Store the key file

Keep the key outside the installation directory, readable only by the user that
runs `alfheim-setup`:

```bash
sudo install -d -m 700 /etc/alfheim
sudo install -m 600 AuthKey_<KEY ID>.p8 /etc/alfheim/AuthKey_<KEY ID>.p8
```

The installer refuses a key file that its group or others can read. Only the
path goes into `.env`; the key itself is uploaded to Zitadel. See
[Secrets hardening](secrets-hardening.md#social-login-credentials).

### 3. Give the values to the installer

Answer **Yes** at the wizard's "external sign-in" step and fill in the Apple
fields, or pass them headless:

```bash
alfheim-setup --non-interactive --domain example.com --tls internal \
  --admin-email ops@example.com \
  --apple-client-id com.example.alfheim.signin --apple-team-id <TEAM ID> \
  --apple-key-id <KEY ID> --apple-private-key-file /etc/alfheim/AuthKey_<KEY ID>.p8
```

On an existing installation, set `ALFHEIM_APPLE_CLIENT_ID`,
`ALFHEIM_APPLE_TEAM_ID`, `ALFHEIM_APPLE_KEY_ID` and
`ALFHEIM_APPLE_PRIVATE_KEY_FILE` in `.env` and re-run `alfheim-setup`. The
provisioning step prints the Return URL to register; it ends in
`/callback/form`, Zitadel's endpoint for Apple's form POST.

### Hidden e-mail (private relay)

A user who chooses **Hide My Email** signs in with an
`@privaterelay.appleid.com` address. It matches no existing account, so Zitadel
creates a new one. To attach that Apple identity to the user's existing account
instead, an administrator moves the link, using the Zitadel user API v2 and the
bootstrap token from `.env`:

```bash
PAT=$(grep '^ZITADEL_BOOTSTRAP_PAT=' .env | cut -d= -f2)
AUTH=https://auth.<your domain>
# 1. Read the Apple link of the account the relay sign-in created
#    (its user ID is shown in the Zitadel console under Users).
curl -s -X POST -H "Authorization: Bearer $PAT" -H 'Content-Type: application/json' \
  -d '{}' "$AUTH/v2/users/<relay account ID>/links/_search"
```

Note `idpId`, `userId` (Apple's subject) and `userName` from the result, then
delete the relay account in the Zitadel console (**Users**), and add the link to
the existing account:

```bash
curl -s -X POST -H "Authorization: Bearer $PAT" -H 'Content-Type: application/json' \
  -d '{"idpLink": {"idpId": "<idpId>", "userId": "<userId>", "userName": "<userName>"}}' \
  "$AUTH/v2/users/<existing account ID>/links"
```

The next Apple sign-in then lands in the existing account.

Apple sends the user's name only on the very first authorization. If it is
missing, Zitadel shows a short form to complete the profile; sign-in is not
blocked.

### Callback and Caddy

Apple POSTs the result to `/ui/login/login/externalidp/callback/form` on the
auth host. Caddy proxies the whole auth host to Zitadel without rewrites, so
the POST reaches Zitadel unchanged. The `form-action 'self'` directive in
Caddy's `Content-Security-Policy-Report-Only` header is report-only and applies
to forms on Alfheim's own pages, not to Apple's form, so it blocks nothing;
Zitadel's own enforced CSP on the login pages sets no `form-action`.

## Rotate a secret or key

* **Google:** change `ALFHEIM_GOOGLE_CLIENT_SECRET` in `.env`.
* **Apple:** create a new key, store it as above, update
  `ALFHEIM_APPLE_KEY_ID` and `ALFHEIM_APPLE_PRIVATE_KEY_FILE`, and revoke the
  old key in the Apple portal after the next step.

Then re-run `alfheim-setup`. The installer keeps a hash of the configured values
in `ZITADEL_<PROVIDER>_IDP_FINGERPRINT`, notices the change and updates the
provider in Zitadel. A run without changes does not touch Zitadel.

## Turn social login off

Empty a provider's values in `.env` (or answer **No** at the wizard's external sign-in
step with `--reconfigure`) and re-run `alfheim-setup`. The provider is taken
off the login page. It is not deleted, because deleting it would also delete
every user's link to it: turning it on again later restores sign-in for those
users. Users created through a provider keep their Zitadel account and can
still be removed in the Zitadel console.

## Troubleshooting

* **`redirect_uri_mismatch` at Google:** the redirect URI registered at Google
  differs from the one the installer printed. Copy it exactly, including
  `https://` and the path.
* **No Google button:** check the provisioning output for a `WARNING: social
  login could not be configured` block. On an existing installation a failure is
  a warning so the update still finishes; fix the cause and re-run
  `alfheim-setup`.
* **`Google sign-in needs both ...`:** only one of the two variables is set.
* **`Apple sign-in needs ...`:** set all four Apple values, or none.
* **`... has mode 0644; it must be readable by its owner only`:** run
  `chmod 600` on the key file and re-run `alfheim-setup`.
* **`invalid_client` at Apple:** the Services ID, Team ID or Key ID does not
  match the key, or the Return URL is not registered on the Services ID.

## See also

* [ADR 0008: Social login policy](../explanation/decisions/0008-social-login-policy.md)
* [Secrets hardening](secrets-hardening.md#social-login-credentials)
* [Authentication and multi-tenancy](../explanation/authentication-security.md)
* [Environment variables](../reference/environment-variables.md#social-login)
* [Installer CLI](../reference/installer-cli.md)
