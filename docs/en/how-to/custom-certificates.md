---
title: "Use Your Own TLS Certificates"
description: "Use this guide when you already hold certificates for your domain — issued by a"
---

Use this guide when you already hold certificates for your domain — issued by a
corporate CA, bought from a commercial CA, or produced by a `certbot` instance
that Alfheim does not manage.

The installer offers two locations, and both expect the same two filenames.

---

## Required filenames

Whichever location you choose, the directory must contain exactly:

| File            | Contents                                          |
| :-------------- | :------------------------------------------------ |
| `fullchain.pem` | Your certificate followed by any intermediate CAs |
| `privkey.pem`   | The matching unencrypted private key              |

Both must be **PEM encoded** — that is, starting with `-----BEGIN`. These are
the names `certbot` already uses in `/etc/letsencrypt/live/<domain>/`, so a
Let's Encrypt directory can be pointed at directly.

The installer checks all of this before starting a container, and refuses with
a specific message rather than letting the gateway fail at runtime.

---

## Option A: The bundled directory (default)

Alfheim reads from `./data/caddy/certs/` inside the installation directory.
Choose this when the certificates belong to this instance and you want a single
directory to back up.

```bash
mkdir -p ~/alfheim/data/caddy/certs
cp fullchain.pem privkey.pem ~/alfheim/data/caddy/certs/
chmod 600 ~/alfheim/data/caddy/certs/privkey.pem
```

Run the installer and choose **Custom certificates → Bundled directory**. It
creates the directory with mode `0700` if it does not exist.

## Option B: A custom host path

Choose this when the certificates are managed elsewhere on the host — by a
system `certbot` timer, or a configuration-management tool.

The path must be **absolute**. A relative path resolves against the Docker
daemon's working directory, not yours, and would silently produce an empty
mount; the installer rejects one outright.

Interactively, choose **Custom certificates → Custom absolute host path**.
Headless:

```bash
alfheim-setup --non-interactive \
  --domain example.com \
  --tls custom \
  --cert-path /etc/letsencrypt/live/example.com
```

The directory is bind-mounted read-only into the gateway at
`/etc/caddy/certs`, and the rendered Caddyfile references the container paths:

```caddyfile
https://example.com {
	tls /etc/caddy/certs/fullchain.pem /etc/caddy/certs/privkey.pem
	...
}
```

---

## Permissions

The installer warns — but does not fail — when `privkey.pem` is readable beyond
its owner:

```
Warning: Private key /etc/.../privkey.pem is readable beyond its owner (mode 0644); consider chmod 600.
```

It is a warning because some setups legitimately manage keys through a group.
Unless you are doing that, tighten it:

```bash
chmod 600 /etc/letsencrypt/live/example.com/privkey.pem
```

## Renewing

Alfheim does not renew certificates it did not issue. After your renewal
process replaces the files, reload the gateway:

```bash
docker compose -f compose.prod.yaml restart caddy
```

With `certbot`, automate it as a deploy hook:

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/alfheim.sh >/dev/null <<'EOF'
#!/bin/sh
cd /home/youruser/alfheim && docker compose -f compose.prod.yaml restart caddy
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/alfheim.sh
```

> Prefer not to manage renewal at all? Use
> [Hetzner DNS-01](./hetzner-dns-tls.md) or Cloudflare DNS-01 and let Caddy
> issue and renew automatically.

---

## Verify

```bash
docker compose -f compose.prod.yaml exec caddy \
  caddy validate --config /etc/caddy/Caddyfile
```

Then confirm the served certificate is the one you supplied:

```bash
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

## Troubleshooting

**`certificate chain not found at .../fullchain.pem`**
The directory does not contain a file with that exact name. Rename your files,
or point `--cert-path` at the directory that holds them.

**`... is not PEM encoded`**
The file is DER or PKCS#12. Convert it:

```bash
openssl x509 -inform der -in cert.der -out fullchain.pem
```

**`certificate path "certs/live" must be absolute`**
Use a path starting with `/`.

**The gateway starts but serves a self-signed certificate**
The bind mount is empty. Confirm the host path exists and that Docker can read
it — a path under another user's home directory often cannot be mounted.

## See also

* [Hetzner DNS-01 TLS](./hetzner-dns-tls.md)
* [Installer CLI reference](../reference/installer-cli.md)
* [Secrets hardening](./secrets-hardening.md)
