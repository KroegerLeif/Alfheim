---
title: "Connect ALFI to a local model"
description: "Point the ALFI assistant at an Ollama server on your network or at an OpenAI-compatible API."
sidebar:
  label: "Connect ALFI to a model"
---

ALFI, the household assistant, needs a language model. You can run one on your own network with
Ollama, or use an OpenAI-compatible API, for example one hosted in the EU. The model is stored as
the household's shared model block in the chat app, which keeps the API key encrypted. The
dashboard card is only a view over it.

ALFI stays hidden on the dashboard until a model passes its connection test.

## Before you start

- The chat app must be installed. If the **ALFI assistant** card says "Chat module not
  installed", the operator runs this on the server (see [Manage apps](./manage-apps.md)):

  ```bash
  alfheim-setup apps enable chat
  ```

- You need the `OWNER` or `ADMIN` role in the household.
- A model host on your network (a private address or a LAN name) must be listed in
  `CHAT_ALLOWED_LLM_HOSTS` on the server, for example `CHAT_ALLOWED_LLM_HOSTS=192.168.1.30` or
  `ollama.lan`. Public APIs need no entry. See
  [environment variables](../reference/environment-variables.md).

## Connect a local Ollama server

1. On the Ollama machine, pull a model, for example `ollama pull llama3.1:8b`, and make Ollama
   listen on the network (`OLLAMA_HOST=0.0.0.0`).
2. In Alfheim, open **Settings → Integrations** and find the **ALFI assistant** card.
3. Choose **Ollama (local)**.
4. Enter the base URL, `http://<host>:11434`, and the model name, `llama3.1:8b`. Ollama needs no
   key.
5. Select **Save and test**. The badge turns **Connected** when chat reaches the model.

## Connect an OpenAI-compatible API

1. Create an API key at your provider.
2. In the **ALFI assistant** card, choose **OpenAI-compatible API**.
3. Enter the base URL **without** `/v1` (chat adds it), the model name and the key.
4. Select **Save and test**.

The key is never shown again; the card only says "API key stored". To keep it, leave the key
field empty when you save. If you change the base URL, enter the key again: chat never sends a
stored key to a different host. Switching to Ollama removes the stored key.

## Troubleshooting

| Message | Cause | Fix |
| :--- | :--- | :--- |
| Chat rejected the address | The host is private and not in `CHAT_ALLOWED_LLM_HOSTS` | Ask the operator to add it and restart chat |
| Unreachable | Ollama does not listen on the network, or a firewall blocks port 11434 | Check `OLLAMA_HOST` and the firewall |
| Key rejected | The provider refused the API key | Enter a valid key and save |
| The API key cannot be stored | The server has no `CHAT_ENCRYPTION_KEY` | Ask the operator to set it |

Household members without an admin role see the card and can rerun the connection test, but
cannot change the model.

## Related

- [Chat reference: household default block](../reference/apps/chat.md)
- [Dashboard reference: ALFI card](../reference/apps/dashboard.md#alfi-card)
- [ADR 0010: Integration architecture](../explanation/decisions/0010-integration-architecture.md)
