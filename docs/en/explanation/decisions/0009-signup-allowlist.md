---
title: "ADR 0009: Optional Sign-up Allowlist for First Households"
description: "An optional ALFHEIM_SIGNUP_ALLOWLIST restricts who may create a first household; the guard lives in core/household, checks only verified e-mail addresses and never blocks invites."
sidebar:
  label: "0009 Sign-up Allowlist"
---

* Status: accepted
* Deciders: Alfheim maintainers
* Date: 2026-11-15
* Supersedes: the "instance becomes open" consequence of [ADR 0008](./0008-social-login-policy.md), for installations that set the allowlist

Technical Story: [#923](https://github.com/KroegerLeif/Alfheim/issues/923)

---

## Context and Problem Statement

[ADR 0008](./0008-social-login-policy.md) creates a first-time Google or Apple user just in time. Such a user can then create their own household, so an instance with social login is open to anyone who holds an account at the provider. Google can be restricted at its consent screen; Apple cannot. Operators of public-facing installations need a way to say who may start using the instance without giving up social login.

Where does the restriction live, and what does it match on?

---

## Decision Drivers

* **Invites keep working:** a household owner must be able to invite anyone, whatever the restriction.
* **Zero trust:** only a verified e-mail address counts; an address the provider did not verify, or one copied into a token, never opens the door.
* **Fail closed:** a typo in the configuration, or an identity lookup that fails, must deny rather than allow.
* **Opt-in:** an installation without the setting behaves exactly as before.
* **One authority:** [ADR 0006](./0006-household-authorization-via-membership-api.md) keeps household decisions in `core/household`.

---

## Considered Options

* **A: Guard household creation in `core/household`** with an allowlist of e-mail addresses and domains.
* **B: Block just-in-time user creation in Zitadel** with an Action or flow.
* **C: Rely on the providers** (Google consent-screen audience) and document that Apple cannot be restricted.

---

## Decision Outcome

Chosen option: **A**.

`household-backend` reads the optional `ALFHEIM_SIGNUP_ALLOWLIST`: comma-separated e-mail addresses (`alice@example.com`) and domains (`@example.com` or `example.com`), matched without regard to case.

* **Empty** (the default): no restriction, the behaviour of ADR 0008.
* **Set:** `POST /api/v1/households` from a caller who is **not a member of any household** succeeds only when the caller's e-mail address, or its domain, is listed **and** verified. Otherwise the API answers `403` with the code `signup_not_allowed`, and the household app explains that an invite is needed.
* **Invites are never restricted:** redeeming an invite does not consult the allowlist, and a member of a household may create further households.
* **Verified address only:** the address and `email_verified` come from the issuer's OIDC userinfo endpoint, called with the caller's own access token. Zitadel's access tokens carry no e-mail claim, and claims in a token are not trusted for this decision.
* **Fail closed:** a malformed entry (a wildcard, a bare word, an address with a display name) stops `household-backend` at startup; a failed userinfo lookup denies the request.

The setting applies to every account, not only social ones: the guard sits behind authentication, where the identity provider no longer matters, and operator-created accounts are usually members already or can be invited.

### Consequences

* Good, because the restriction works for Apple, which cannot be limited at the provider.
* Good, because a stranger can still sign in but sees only an empty state with a clear message; nothing in the instance becomes visible to them.
* Good, because invites, the main way households grow, are unaffected.
* Bad, because an unlisted stranger's Zitadel account is still created just in time. It holds no data and can be removed in the Zitadel console; blocking it would need option B.
* Bad, because creating a first household needs one userinfo request to Zitadel while the allowlist is set.

---

## Pros and Cons of the Options

### A: Guard household creation in `core/household`

* Good, because it lives next to the membership data it depends on (existing members are exempt).
* Good, because it is plain Go with unit tests, independent of the Zitadel version.
* Bad, because the Zitadel user exists before the guard runs.

### B: Block just-in-time creation in Zitadel

* Good, because no account is created for a stranger.
* Bad, because Zitadel Actions are JavaScript inside the identity provider, versioned and deployed apart from the code, and their API changes between Zitadel versions.
* Bad, because a blocked login ends on a Zitadel error page Alfheim cannot explain.

### C: Rely on the providers

* Good, because nothing new is built.
* Bad, because Apple has no audience restriction, so the gap that motivated this ADR stays open.

---

## Links

* [ADR 0008: Social Login Policy](./0008-social-login-policy.md)
* [Set up social login](../../how-to/social-login.md#restrict-who-can-create-a-household)
* [Environment variables](../../reference/environment-variables.md#social-login)
