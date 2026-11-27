---
title: "Connect a media server"
description: "Show what your Jellyfin or Navidrome server is playing on the dashboard and control Jellyfin playback."
sidebar:
  label: "Connect a media server"
---

The dashboard can show what your household's Jellyfin or Navidrome server is playing and, for
Jellyfin, pause, skip or stop playback. Alfheim only reads the playback status and sends control
commands. Your media streams stay on your network between the player and the server; Alfheim
never proxies or transcodes them.

You need:

- The `OWNER` or `ADMIN` role in the household.
- An operator who set `INTEGRATIONS_ENCRYPTION_KEY`, so credentials can be stored.
- The media server's address listed in `INTEGRATIONS_ALLOWED_HOSTS` when it has a private
  address (for example `192.168.1.20` or `jellyfin.lan`). See
  [environment variables](../reference/environment-variables.md).

## Connect Jellyfin

1. In Jellyfin, open **Dashboard → API Keys**, add a key named `Alfheim` and copy it.
2. In Alfheim, open **Settings → Integrations** and find the **Jellyfin** card.
3. Enter the server address, for example `http://jellyfin.lan:8096`, and paste the API key.
4. Select **Save**. A new integration is enabled when you first save it.
5. Select **Test connection**. The badge turns **Connected** and shows the Jellyfin version.

## Connect Navidrome

Navidrome speaks the Subsonic API, which has no remote control, so its sessions are shown
read-only.

1. In Navidrome, create a user for Alfheim, or use an existing one.
2. In Alfheim, open **Settings → Integrations** and find the **Navidrome** card.
3. Enter the server address, for example `http://navidrome.lan:4533`, the user name and the
   password. Alfheim stores both encrypted and signs each request with a salted token, so the
   password itself is never sent.
4. Select **Save**, then **Test connection**.

## Use the widget

Once a media server is enabled, the dashboard shows a **Now playing** section with each active
session, its device and whether it plays or is paused. Owners, admins and members see playback
controls on sessions that accept them; guests only see the status. The section refreshes every
15 seconds and stays hidden while no media server is enabled.

## Troubleshooting

| Badge or message | Cause | Fix |
| :--- | :--- | :--- |
| Host not allowed | The address is private and not in `INTEGRATIONS_ALLOWED_HOSTS` | Ask the operator to add the host, IP or CIDR |
| Sign-in failed | Wrong API key, user name or password | Enter the credentials again and save |
| Unexpected answer | The address does not point at the server's root | Use the base address without `/web` or `/app` |
| No controls on a session | The client does not accept remote control, or the server is Navidrome | Use the player itself |

To stop showing a server, switch its card off. The stored credentials are kept until you
replace them.

## Related

- [Dashboard reference: media servers](../reference/apps/dashboard.md#media-servers)
- [Add an external app launcher](./add-external-app-launcher.md)
- [ADR 0010: Integration architecture](../explanation/decisions/0010-integration-architecture.md)
