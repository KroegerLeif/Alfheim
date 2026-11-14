---
title: "ADR 0008: Social Login Policy (Google and Apple)"
description: "First-time Google or Apple users are created just in time and linked to an existing account only by a verified e-mail; household and role assignment stays with core/household."
sidebar:
  label: "0008 Social Login Policy"
---

* Status: accepted
* Deciders: Alfheim maintainers
* Date: 2026-11-14

Technical Story: [#884](https://github.com/KroegerLeif/Alfheim/issues/884), implemented by [#885](https://github.com/KroegerLeif/Alfheim/issues/885) (Google) and [#886](https://github.com/KroegerLeif/Alfheim/issues/886) (Apple)

---

## Context and Problem Statement

Zitadel is provisioned with self-registration off: `alfheim-setup` sets `allowRegister=false` on the instance login policy (and on a custom organization policy, if one exists). Operators want "Sign in with Google" and "Sign in with Apple". A person who signs in through one of them for the first time has no Zitadel user yet.

What happens to that person, how is an existing account matched, and how does this fit the rule that only `core/household` decides household membership and roles?

---

## Decision Drivers

* **No dead end:** a first-time social login must end in a working session, not on an error page or a manual approval queue.
* **No account takeover:** an external identity may join an existing account only on proof that both sides own the same address.
* **Zero trust stays intact:** Zitadel authenticates; [ADR 0006](./0006-household-authorization-via-membership-api.md) still decides households and roles.
* **Local registration stays closed:** nobody creates a username/password account from the login page.
* **Opt-in:** an installation without provider credentials behaves exactly as before.

---

## Considered Options

* **A: Just-in-time (JIT) provisioning with automatic linking by verified e-mail.**
* **B: Invite-only social login** (a social identity can only be linked to an account the operator created).
* **C: Zitadel's manual "external user not found" page** (the user chooses between creating and linking).

---

## Decision Outcome

Chosen option: **A**, because it is the only option without a dead end and without an operator step per user, and Zitadel v4 enforces the verified-e-mail rule itself.

### 1. JIT auto-provisioning

The first successful Google or Apple login creates the Zitadel user automatically. No approval step, no intermediate page.

### 2. Automatic linking by verified e-mail only

If a Zitadel user with the same **verified** e-mail exists (with local credentials or the other provider), the external identity is linked to that user instead of creating a second one. An unverified address on either side never links: Zitadel skips the match and falls through to creation.

### 3. Zero-trust household and role assignment is unchanged

A JIT-created user has no household and no role. The dashboard sends them to onboarding, where they accept an invitation or create their own household through the `core/household` membership API. No backend reads household or role claims from the token.

### 4. Local registration stays off; social login is opt-in

`allowRegister` stays `false`. A provider is configured only when the operator supplies its credentials; removing them takes the provider off the login page again.

### Zitadel v4 settings that implement the decision

Each provider is an instance-level identity provider created through the Admin API (`POST /admin/v1/idps/google`, `POST /admin/v1/idps/apple`) with these `providerOptions`:

| Option | Value | Effect |
| :--- | :--- | :--- |
| `isCreationAllowed` | `true` | A new user may be created from the external identity (decision 1). |
| `isAutoCreation` | `true` | Creation happens without the "external user not found" page (decision 1). |
| `isAutoUpdate` | `true` | Name and e-mail are refreshed from the provider on every login. |
| `isLinkingAllowed` | `true` | The external identity may be linked to an existing user (decision 2). |
| `autoLinking` | `AUTO_LINKING_OPTION_EMAIL` | Linking is automatic and matches on a verified e-mail (decision 2). |

Login policy settings, on the instance policy and on a custom organization policy if one exists:

| Setting | Value | Why |
| :--- | :--- | :--- |
| `allowRegister` | `false` | Hides local username/password registration (decision 4). |
| `allowExternalIdp` | `true` while at least one provider is configured | Without it Zitadel neither shows the buttons nor accepts the callback. |
| `allowUsernamePassword` | unchanged | The operator account and invited users keep their passwords. |
| Identity provider links | the configured providers | A provider shows up on the login page only when it is linked to the policy. |

Scopes: Google `openid profile email`; Apple `name email` (Zitadel adds `openid`).

#### Verified against the Zitadel v4.20.3 source

`allowRegister=false` does **not** block JIT creation through an external provider. Paths below are in the `zitadel/zitadel` repository at tag `v4.20.3`:

* `allowRegister` is read only by the local registration pages: `checkRegistrationAllowed` in `internal/api/ui/login/register_handler.go` (lines 70 to 84) and `registrationAllowed` in `internal/api/ui/login/register_option_handler.go` (lines 80 to 82). Both require `AllowRegister && AllowUsernamePassword`.
* The external callback path never reads it: `createOrLinkUser` (`internal/api/ui/login/external_provider_handler.go`, line 668) runs auto-linking (line 678), then, when `IsAutoCreation` is set (line 691), `autoCreateExternalUser` (line 713) and `registerExternalUser` (line 887), which calls `AutoRegisterExternalUser` (line 902). That one (`internal/auth/repository/eventsourcing/eventstore/auth_request.go`, line 607) calls `Commands.AddUserHuman` (line 622, defined in `internal/command/user_v2_human.go`, line 121) without any login policy check.
* What the external path does require is `allowExternalIdp`: without it the policy lists no providers (`auth_request.go`, line 701) and a callback with an external identity fails with `LOGIN-s9sio` (line 974). The provider must also be linked to the policy (`auth_request.go`, line 978; `checkAutoLinkingAllowedForUserAndIdP` in `external_provider_handler.go`, lines 632 to 644).
* E-mail auto-linking is skipped unless the provider reports the address as verified, and it only searches verified Zitadel e-mails (`external_provider_handler.go`, lines 605 to 613).

So `allowRegister=false` plus `allowExternalIdp=true` plus the options above is the complete combination; no registration setting has to be opened. The installer test `TestEnsureIDPPolicyKeepsRegistrationClosed` locks it in.

### Resolution of the open points

* **Open instance.** With social login on, any Google or Apple account that can reach the instance can sign in and create its own household. Chosen guard: **an explicit statement that the instance is open**, made visible by `alfheim-setup` when it enables a provider. Rationale: it needs no new code path that could fail open; the zero-trust model already confines such a user to their own household (no access to other households' data, files or chat); and social login is off unless the operator configures it. Operators who want a closed instance restrict the audience at the provider: Google's OAuth consent screen in **Testing** mode (only listed test users) or **Internal** (only the operator's Workspace domain). Apple has no audience restriction, so an operator who needs a closed instance does not enable Apple. An allowlist enforced in `core/household` would need its own ADR.
* **Verified e-mail only.** Enforced by Zitadel (see above) and by `autoLinking=AUTO_LINKING_OPTION_EMAIL`; Alfheim adds no linking logic of its own. Google and Apple both report `email_verified`.
* **Apple private relay.** A user who hides their e-mail gets an `@privaterelay.appleid.com` address, which matches no existing user, so JIT creates a new account. To use Apple with an existing account instead, the user signs in with their existing method, opens the Zitadel account page (`https://<auth host>/ui/console/users/me`), and adds Apple under identity providers. The stray JIT account, if one was created first, is deleted by the operator in the Zitadel console.
* **Required profile fields.** Zitadel needs a given name, a family name and an e-mail. Google always sends them. Apple sends the name only on the very first authorization. If a field is missing, automatic creation fails and Zitadel shows its "external user not found" form, pre-filled with what the provider sent and with a "register" button (`renderExternalNotFoundOption`, `external_provider_handler.go`, line 727, enabled by `isCreationAllowed`). Login is therefore not blocked; the user types the missing field once.

### Positive Consequences

* A first-time user reaches onboarding in one step; an existing user keeps one account across password, Google and Apple.
* No Alfheim code decides identity linking; Zitadel's verified-e-mail rule does.
* Households and roles keep their single source of truth.

### Negative Consequences & Accepted Costs

* With social login enabled, the instance is open to every account of that provider unless the operator restricts the audience at the provider. Storage and chat can be used by such a user within their own household.
* Apple relay users get a separate account until they link it by hand.

---

## Pros and Cons of the Options

### A: JIT provisioning with linking by verified e-mail

* Good, because there is no dead end and no operator step.
* Good, because Zitadel enforces the verified-e-mail rule.
* Bad, because it opens the instance to the provider's whole user base (mitigated at the provider).

### B: Invite-only social login

* Good, because the instance stays closed.
* Bad, because every new user needs an operator-created account first, and a first login of an unknown person ends on an error page.

### C: Manual "external user not found" page

* Good, because the user sees what happens.
* Bad, because the page offers creation and linking by password, which is confusing and still opens the instance.
