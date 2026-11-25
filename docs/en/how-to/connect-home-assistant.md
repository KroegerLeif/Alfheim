---
title: "Connect Home Assistant"
description: "Show Home Assistant states on the dashboard, let ALFI use Home Assistant's MCP server and let Home Assistant automations create chores."
sidebar:
  label: "Connect Home Assistant"
---

The Home Assistant integration connects one Home Assistant per household. Once it is connected:

* the dashboard reads the states of the entities you pin,
* ALFI (the chat assistant) can use Home Assistant's MCP server, read-only unless you allow
  control,
* Home Assistant automations can send signed events to Alfheim, for example "washing machine
  finished", and a rule turns each event into a chore.

The access token stays in the dashboard backend, encrypted. Alfheim never shows it again, and
chat never receives it: ALFI reaches Home Assistant through the dashboard's MCP proxy.

## Before you start

* You are an `OWNER` or `ADMIN` of the household.
* The operator set `INTEGRATIONS_ENCRYPTION_KEY` and, for a Home Assistant on your LAN, added its
  host or address to `INTEGRATIONS_ALLOWED_HOSTS` (for example `homeassistant.lan` or
  `192.168.1.0/24`). See [environment variables](../reference/environment-variables.md).
* For automations: the installation has its service principal (`INTEGRATIONS_CLIENT_ID`,
  `INTEGRATIONS_CLIENT_SECRET`, `INTEGRATIONS_PRINCIPAL_ID`, provisioned by `alfheim-setup`) and
  runs the chores app.
* Home Assistant can reach your Alfheim address, and its **Model Context Protocol Server**
  integration is set up if ALFI should use it.

## Connect Home Assistant

1. In Home Assistant, open your profile, then **Security**, and create a **long-lived access
   token**. Copy it.
2. In the Alfheim dashboard, open **Settings** and find **Home Assistant** under
   **Integrations**.
3. Enter the **Home Assistant address**, for example `http://192.168.1.20:8123`, and paste the
   token.
4. Pin the entities whose states the dashboard should show, for example
   `sensor.living_room_temperature`.
5. With chat installed, decide whether **Let ALFI control devices** is on. Off (the default)
   offers ALFI only Home Assistant's read tools (`GetLiveContext`, `GetDateTime` and other
   `Get…` tools); the dashboard rejects every other tool call itself.
6. Select **Save settings**, switch the integration on and select **Test connection**. The
   status shows **Connected** when Home Assistant accepted the token.

Switching the integration on binds the household's service principal with the scope
`chores:create_instance` in the household app; switching it off removes the binding.

## Send events from Home Assistant

1. Under **Automations**, select **Generate secret**. The secret is shown once, inside the
   configuration below it. Generating a new one invalidates the old one.
2. Select **Copy configuration** and paste it into Home Assistant's `configuration.yaml`, then
   restart Home Assistant. It defines `shell_command.alfheim_event`, which signs each event with
   the secret (HMAC-SHA256 over timestamp and body, computed with `openssl`) and posts it with
   `curl`. Home Assistant's `rest_command` cannot compute a signature, so the integration uses a
   shell command. The event id and type are passed as arguments, never pasted into the script.
3. Under **Rules**, add a rule: an **event type** such as `washer_finished` and the id of the
   chore template to create. Find the template id in the chores app.
4. Add an automation that calls the command:

```yaml
automation:
  - alias: Washing machine finished
    triggers:
      - trigger: state
        entity_id: sensor.washing_machine_operation_state
        to: finished
    actions:
      - action: shell_command.alfheim_event
        data:
          event_type: washer_finished
          event_id: "washer-{{ now().timestamp() | int }}"
```

When the washing machine finishes, Alfheim creates a one-off chore from the template. **Recent
events** lists the last 20 events with their outcome: **Done**, **Skipped** (chores is not
installed), **No rule** or **Failed** with a reason.

## How events are protected

* Each request carries `X-Alfheim-Webhook-Id`, `X-Alfheim-Timestamp` and `X-Alfheim-Signature`.
  Requests older or newer than 300 seconds, with a wrong signature or a body over 16 KiB are
  rejected before anything runs.
* The household comes from the integration the webhook id names, never from the event.
* An `event_id` is handled once: a repeat answers `200` and runs nothing. Chores also receives it
  as `Idempotency-Key`.
* The gateway limits the webhook to `ALFHEIM_RATE_LIMIT_WEBHOOK` requests per minute and client
  address (default 30).

## Troubleshooting

| Symptom | Cause |
| :--- | :--- |
| Status **Host not allowed** | The address is not in `INTEGRATIONS_ALLOWED_HOSTS`. |
| Status **Sign-in failed** | Home Assistant rejected the token; create a new one. |
| Switching on fails | The household app could not bind the service principal; try again later. |
| Events answer `401` | Wrong secret or clock skew over 300 seconds between Home Assistant and Alfheim. |
| Events show **Failed** | See the reason: a missing template, no service principal or chores unreachable. |

Reference: [dashboard](../reference/apps/dashboard.md#home-assistant),
[ingress matrix](../reference/ingress-matrix.md#rate-limits),
[integration architecture (ADR 0010)](../explanation/decisions/0010-integration-architecture.md).
