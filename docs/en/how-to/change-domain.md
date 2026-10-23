---
title: "Change the domain of an installation"
description: "Move an existing Alfheim instance to a new app or auth host with alfheim-setup --reconfigure, keeping all data, secrets and accounts."
---

Use this guide to move a running Alfheim instance to new host names, for
example from `alfheim.old.example` / `auth.old.example` to
`alfheim.example.com` / `auth.example.com`. No reinstall is needed: data,
secrets, user accounts and households are kept.

## What changes and what stays

| Changes | Stays |
| :--- | :--- |
| `DOMAIN`, `ALFHEIM_HOST`, `ZITADEL_EXTERNALDOMAIN` in `.env` | Every secret, including `ZITADEL_MASTERKEY` |
| The Caddyfile | All databases and volumes |
| TLS certificates (Caddy obtains new ones) | Zitadel users, roles and the OIDC clients' ids |
| OIDC redirect URIs (re-registered) | The TLS strategy, unless you choose another |

Zitadel moves its instance to the new auth host by itself the next time it
starts with the new `ZITADEL_EXTERNALDOMAIN` (its `config_change` setup step).

---

## Prerequisites

* DNS records for **both** new hosts pointing at the server.
* For a DNS-01 strategy (Hetzner, Cloudflare, deSEC): a token that can edit the
  new zone. If the zone lives in another account, create a token there.
* A backup, as before any change: [Backup and restore](./backup-restore.md).

## Step 1: Re-run the wizard

```bash
cd /root && alfheim-setup --reconfigure
```

Enter the new domain and app host. Headless, pass every answer again:

```bash
alfheim-setup --reconfigure --non-interactive \
  --domain example.com --app-host alfheim.example.com \
  --tls desec --api-token "$DESEC_TOKEN" \
  --admin-email ops@example.com
```

The installer prints the change before it applies it:

```
Domain change: alfheim.old.example / auth.old.example -> alfheim.example.com / auth.example.com
```

## Step 2: Let it finish

The installer restarts Caddy and Zitadel with the new configuration, waits
for the new certificates (*Phase: Certificates*), re-registers the redirect
URIs in Zitadel and restarts every app with the new issuer URL.

## Verify

1. Open `https://<new app host>` and sign in.
2. Check the certificate:

   ```bash
   echo | openssl s_client -connect 127.0.0.1:443 -servername auth.example.com 2>/dev/null \
     | openssl x509 -noout -subject -issuer -dates
   ```

## Afterwards

* Bookmarks and installed PWAs point at the old host; replace them.
* Remove the old DNS records once nothing uses them anymore.
* Later updates need nothing special: `alfheim-setup update` reuses the new
  configuration.

## See also

* [Installer CLI reference](../reference/installer-cli.md)
* [Wildcard TLS with deSEC DNS-01](./desec-dns-tls.md)
* [Update an installation](./update-installation.md)
