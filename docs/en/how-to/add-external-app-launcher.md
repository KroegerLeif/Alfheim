---
title: "Add an external app launcher"
description: "Put a tile for Home Assistant, Jellyfin, Navidrome, YouTube or any other web app on your household's dashboard."
sidebar:
  label: "External app launchers"
---

A household launcher is a dashboard tile that opens one of your household's other web apps,
such as Home Assistant or Jellyfin, in a new browser tab. Household owners and admins manage
launchers in the dashboard; every member of the household sees them. Nothing needs to be
redeployed.

A launcher is only a link. Alfheim never contacts the target, never stores a password or token
for it, and never embeds it in the dashboard. You still sign in to the target app as usual.

## Before you start

* You are an `OWNER` or `ADMIN` of the household. Members and guests see the launchers but not
  the controls to change them.
* The target app has an `http://` or `https://` address your devices can open, for example
  `http://192.168.1.20:8123` for Home Assistant or `https://jellyfin.example.com`.

## Add a launcher

1. Open the dashboard and select the household in the header.
2. In **Household Apps**, select **Add app link**.
3. Pick a **Preset**: Home Assistant, Jellyfin, Navidrome or YouTube fill in the title and the
   icon. Pick **Custom** for any other app.
4. Enter the **Address (URL)** of the app, for example `http://192.168.1.20:8123`.
5. Adjust the title, icon or description if you like, then select **Save**.

The tile appears for every member of the household, after the Alfheim apps and before the
operator's stack apps.

## Change or remove a launcher

Use the pencil button on a tile to edit it and the bin button to remove it. Removing a launcher
removes it for the whole household.

## When the address is rejected

The dashboard rejects an address instead of correcting it. Check that it:

* starts with `http://` or `https://` (no `javascript:`, `data:` or relative paths),
* contains no user name or password (`https://user:pass@host` is not allowed; sign in inside the
  app instead),
* has no spaces and is at most 2048 characters long.

## Related

* [Dashboard reference](../reference/apps/dashboard.md#household-launchers): endpoints, roles and
  the three link scopes (operator stack apps, household launchers, personal links).
* [ADR 0010: Integration architecture](../explanation/decisions/0010-integration-architecture.md):
  why launchers stay links and what typed plugins add.
