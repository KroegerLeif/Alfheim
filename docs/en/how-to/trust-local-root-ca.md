---
title: "Trust the Local Root CA"
description: "Make browsers and devices trust the root CA that alfheim-setup generates for the internal TLS strategy, or accept the warning for both hosts instead."
sidebar:
  label: "Trust the Local Root CA"
---

Use this guide after installing with the `internal` TLS strategy
(`--tls internal`, or *Local CA (self-signed HTTPS)* in the wizard), including
the LAN `.localhost` preset.

## Why this is needed

Alfheim's sign-in uses PKCE, which needs Web Crypto, which browsers only enable
over HTTPS. The `internal` strategy therefore serves HTTPS for every host, with
certificates signed by a root CA the installer generates for this installation.
No browser or operating system trusts that root out of the box, so the first
visit shows a certificate warning.

Browsers keep certificate exceptions **per host**. Accepting the warning for
the app host does not cover the auth host, and the login's background request
to the auth host is rejected without a prompt. The dashboard then shows
*Sign-in service not reachable* with a link to the auth host.

Importing the root once fixes this for every Alfheim host on that device.

## Before you start

The installer writes two files:

| File | Contents | Share it? |
| :--- | :--- | :--- |
| `infrastructure/ca/alfheim-root-ca.crt` | Public root certificate | Yes, this is the file you import |
| `infrastructure/caddy/pki/root.key` | Private key of the root (mode `0600`) | **Never.** Anyone holding it can issue certificates your devices trust |

The root is named *Alfheim Local Root CA (&lt;your domain&gt;)*, is valid for ten
years and is never replaced silently: `--reconfigure` and updates reuse it.

## Step 1: Verify the fingerprint

Copy `alfheim-root-ca.crt` to the device, then compare its SHA-256 fingerprint
with the one the installer printed (`Generated local root CA … (SHA-256 …)`):

```bash
openssl x509 -noout -fingerprint -sha256 -in infrastructure/ca/alfheim-root-ca.crt
```

Import the file only if both values match.

## Step 2: Import the root

Pick the store your browser actually reads.

* **macOS** (Safari, Chrome, Edge): open *Keychain Access*, import the file into
  the *System* keychain, open the certificate and set *Trust* to *Always Trust*.
* **Windows** (Chrome, Edge): run `certmgr.msc`, open *Trusted Root
  Certification Authorities → Certificates*, then *All Tasks → Import*.
* **Linux, system-wide** (Debian/Ubuntu; used by `curl` and most tools):

  ```bash
  sudo cp alfheim-root-ca.crt /usr/local/share/ca-certificates/
  sudo update-ca-certificates
  ```

  Chrome and Chromium on Linux use their own store: *Settings → Privacy and
  security → Security → Manage certificates → Authorities → Import*.
* **Firefox** (every OS): *Settings → Privacy & Security → Certificates → View
  Certificates → Authorities → Import*, then tick *Trust this CA to identify
  websites*.
* **Android**: *Settings → Security → Encryption & credentials → Install a
  certificate → CA certificate*. Menu names vary by vendor. Chrome uses this
  store; Firefox for Android only does after enabling *Use third party CA
  certificates* in its secret settings.
* **iOS / iPadOS**: send the file to the device (AirDrop or mail), install it
  under *Settings → General → VPN & Device Management*, then enable it under
  *Settings → General → About → Certificate Trust Settings*.

Restart the browser afterwards.

## Fallback: accept the warning for both hosts

If you cannot import the root, open **both** URLs the installer printed and
accept the certificate warning on each before signing in:

* `https://<app host>`, for example `https://alfheim.example.lan`
* `https://<auth host>`, for example `https://auth.example.lan`

Exceptions can expire or be cleared with the browser data, so you may need to
repeat this.

## Verify

Open the dashboard and sign in. The address bar shows no warning for either
host, and the login redirects to the auth host and back without error.

## Troubleshooting

**The dashboard shows *Sign-in service not reachable*.**
The auth host's certificate is not trusted yet (or Zitadel is down). Follow the
link on that page, accept or trust the certificate, and reload.

**The dashboard shows *Secure connection (HTTPS) required*.**
You opened the app over `http://`. Use the `https://` link on that page. An
install from before `internal` served HTTPS migrates with
`alfheim-setup --reconfigure`.

**The warning persists after importing.**
Check you imported into the store your browser reads (Firefox and Chrome on
Linux have their own), and that the fingerprint matches the current root.

## See also

* [Installer CLI reference](../reference/installer-cli.md)
* [Use your own TLS certificates](./custom-certificates.md)
* [Known issues & system trade-offs](../explanation/known-issues.md)
