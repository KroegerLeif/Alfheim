"""Household-bound service principals (#958, ADR 0010 section 6).

A service principal is a Zitadel machine user that ``core/household`` binds to one household
with a list of scopes. The membership API answers for it with the role ``SERVICE``. It is never
a member: :func:`backend_shared.household.require_household` rejects it, and an endpoint admits it
only through :func:`backend_shared.household.require_household_access` with
``allow_service_scopes``.
"""

from collections.abc import Collection, Iterable
from dataclasses import dataclass
from typing import Literal

ServiceRole = Literal["SERVICE"]
SERVICE_ROLE: ServiceRole = "SERVICE"


@dataclass(frozen=True, slots=True)
class ServiceGrant:
    """Membership answer for a service principal: the scopes its binding grants in the household."""

    scopes: frozenset[str]

    @classmethod
    def of(cls, scopes: Iterable[str]) -> ServiceGrant:
        """Build a grant from any iterable of scope strings."""
        return cls(frozenset(scopes))


def normalize_service_scopes(scopes: Collection[str] | str) -> frozenset[str]:
    """Validate the scopes an endpoint requires; a bare string is refused to avoid iterating characters."""
    if isinstance(scopes, str):
        raise TypeError("allow_service_scopes must be a collection of scope strings, not a string")
    normalized = frozenset(scopes)
    if any(not isinstance(s, str) or ":" not in s for s in normalized):
        raise ValueError(f"service scopes must look like '<app>:<action>': {sorted(map(str, normalized))}")
    return normalized


def admits_service(required: frozenset[str], granted: frozenset[str]) -> bool:
    """Whether a principal holding ``granted`` may pass an endpoint requiring ``required``.

    Fails closed: an endpoint that names no scope admits no service principal.
    """
    return bool(required) and required <= granted


__all__ = ["SERVICE_ROLE", "ServiceGrant", "ServiceRole", "admits_service", "normalize_service_scopes"]
