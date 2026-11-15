---
title: "Configure e-mail (SMTP)"
description: "Give Zitadel an SMTP server so password resets, invitations and e-mail verification work, or switch e-mail off again."
sidebar:
  label: "E-mail (SMTP)"
---

Zitadel sends every sign-in e-mail itself: password reset codes, invitations and
initial passwords for users you create in the console, and e-mail verification
codes. It needs an SMTP server for that. `alfheim-setup` configures it for you;
you never set it up in the Zitadel console by hand.

E-mail is optional and off by default. Without it:

* Password reset, invitations and e-mail verification do not work.
* The login page hides **Forgot password**, so nobody waits for a code that
  never arrives.
* Self-registration stays off, as it always is
  ([ADR 0008](../explanation/decisions/0008-social-login-policy.md)), so no
  sign-in flow needs an e-mail. Give users a password in the Zitadel console.

The installer says so in its summary. With e-mail on, users can verify their
address, which is also what lets Google and Apple sign-in link to an existing
account by verified e-mail (ADR 0008).

## What you need

* An SMTP server that accepts mail from this host: your mail provider's
  submission server or a transactional mail service.
* Its host name and port. Port `587` (STARTTLS) is the default; `465` (implicit
  TLS) works too.
* A user and password, unless the server is a relay that needs no
  authentication.
* A sender address the server may send as, for example
  `alfheim@example.com`.

## Turn e-mail on

On a new installation, answer **Yes** at the wizard's "e-mail (SMTP)" step, or
pass the values headless:

```bash
export ALFHEIM_SMTP_PASSWORD='<smtp password>'
alfheim-setup --non-interactive --domain example.com --tls internal \
  --admin-email ops@example.com \
  --smtp-host smtp.example.com --smtp-user alfheim \
  --smtp-sender-address alfheim@example.com
```

The password has no flag on purpose: a flag value is visible in the process
list. Optional flags: `--smtp-port` (default `587`), `--smtp-sender-name`
(default `Alfheim`) and `--smtp-tls` (default `true`; set `false` only for a
relay on the same host, because Zitadel refuses to send a password over a plain
connection to anything else).

On an existing installation, set the values in `.env` and re-run the installer:

```bash
# in the installation root
sed -i 's|^ALFHEIM_SMTP_HOST=.*|ALFHEIM_SMTP_HOST=smtp.example.com|' .env
sed -i 's|^ALFHEIM_SMTP_USER=.*|ALFHEIM_SMTP_USER=alfheim|' .env
sed -i 's|^ALFHEIM_SMTP_PASSWORD=.*|ALFHEIM_SMTP_PASSWORD=<smtp password>|' .env
sed -i 's|^ALFHEIM_SMTP_SENDER_ADDRESS=.*|ALFHEIM_SMTP_SENDER_ADDRESS=alfheim@example.com|' .env
alfheim-setup
```

A plain re-run (or `alfheim-setup update`) reconciles Zitadel from `.env`. If
your `.env` predates this setting and has no `ALFHEIM_SMTP_*` lines, append them
instead.

The provisioning step prints:

```text
E-mail (SMTP): mail server created and active.
```

The installer creates one SMTP provider in Zitadel (description "Alfheim
installer (alfheim-setup)"), activates it and shows **Forgot password** on the
login page again. `.env` is mode `0600`; the password is never printed.

## Check it

Sign out, choose **Forgot password** on the login page and enter your
administrator e-mail. The reset code should arrive within a minute. If it does
not, check the Zitadel log (`docker logs alfheim_zitadel`) for the SMTP error.

## Change a value or the password

Change it in `.env` and re-run `alfheim-setup`. The installer keeps a hash of
the configured values in `ZITADEL_SMTP_FINGERPRINT`, notices the change and
updates the provider. A run without changes does not touch Zitadel.

## Turn e-mail off

Empty the `ALFHEIM_SMTP_*` values in `.env` (or answer **No** at the wizard's
e-mail step with `--reconfigure`) and re-run `alfheim-setup`. The installer
deletes its provider, including the stored password, and hides **Forgot
password** again.

An e-mail provider you added in the Zitadel console yourself is never changed.
While one is active, the installer leaves **Forgot password** visible and
reports that the console's provider is in use.

## Troubleshooting

* **`ALFHEIM_SMTP_HOST is required ...`:** another `ALFHEIM_SMTP_*` value is set
  without a host. Set the host or empty them all.
* **`... must be a bare host name ...`:** put the port in `ALFHEIM_SMTP_PORT`,
  not in the host.
* **`... go together`:** set both user and password, or neither for a relay.
* **`WARNING: the SMTP e-mail provider could not be configured`:** on an
  existing installation a failure is a warning so the update still finishes.
  Zitadel rejects a sender address on an unverified domain when its domain
  policy requires a matching one; fix the cause and re-run `alfheim-setup`.
