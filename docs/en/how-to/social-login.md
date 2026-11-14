---
title: "Set up social login"
description: "Add Sign in with Google to the Zitadel login page of an Alfheim installation, or take it off again."
sidebar:
  label: "Social login"
---

Social login adds a "Sign in with Google" button to the Zitadel login page. It is
off by default. `alfheim-setup` turns it on when you supply the provider's
credentials; you never configure the identity provider in the Zitadel console by
hand.

What happens at the first sign-in is decided in
[ADR 0008](../explanation/decisions/0008-social-login-policy.md):

* A person without an Alfheim account gets one just in time and starts without a
  household (onboarding asks them to accept an invitation or create one).
* A person whose **verified** e-mail matches an existing account is linked to it.
* Local username/password registration stays off.

> **Your instance becomes open.** Anyone with an account at the provider who can
> reach your instance can sign in and create their own household. They cannot see
> other households. To keep the instance closed, restrict the audience at the
> provider (see below).

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

## Rotate a secret

Change `ALFHEIM_GOOGLE_CLIENT_SECRET` in `.env` and re-run `alfheim-setup`.
The installer keeps a hash of the configured credentials in
`ZITADEL_GOOGLE_IDP_FINGERPRINT`, notices the change and updates the provider in
Zitadel. A run without changes does not touch Zitadel.

## Turn social login off

Empty both values in `.env` (or answer **No** at the wizard's external sign-in
step with `--reconfigure`) and re-run `alfheim-setup`. The provider is taken
off the login page. It is not deleted, because deleting it would also delete
every user's link to it: turning it on again later restores sign-in for those
users. Users created through Google keep their Zitadel account and can still be
removed in the Zitadel console.

## Troubleshooting

* **`redirect_uri_mismatch` at Google:** the redirect URI registered at Google
  differs from the one the installer printed. Copy it exactly, including
  `https://` and the path.
* **No Google button:** check the provisioning output for a `WARNING: social
  login could not be configured` block. On an existing installation a failure is
  a warning so the update still finishes; fix the cause and re-run
  `alfheim-setup`.
* **`Google sign-in needs both ...`:** only one of the two variables is set.

## See also

* [ADR 0008: Social login policy](../explanation/decisions/0008-social-login-policy.md)
* [Authentication and multi-tenancy](../explanation/authentication-security.md)
* [Environment variables](../reference/environment-variables.md#social-login)
* [Installer CLI](../reference/installer-cli.md)
