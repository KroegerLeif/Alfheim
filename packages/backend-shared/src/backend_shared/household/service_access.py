"""Admission of household-bound service principals (#958): membership answers, contexts, opt-in routes.

The names here are re-exported by :mod:`backend_shared.household`. They need the package's core
types, which import this module, so those are imported when a function runs, never at import time.
"""

import logging
import uuid
from collections.abc import Callable, Collection
from typing import Any

from fastapi import Depends, Request, status

from backend_shared.household.service_principals import (
    SERVICE_ROLE,
    ServiceGrant,
    admits_service,
    normalize_service_scopes,
)

logger = logging.getLogger("backend_shared.household")


def service_grant_from_answer(scopes: Any) -> ServiceGrant:
    """Build the grant from the ``scopes`` of a ``SERVICE`` membership answer.

    Raises:
        MembershipServiceError: The scopes are not a list of strings.
    """
    from backend_shared.household import MembershipServiceError

    if not isinstance(scopes, list) or not all(isinstance(s, str) for s in scopes):
        logger.error("Household membership API returned unreadable service scopes: %r", scopes)
        raise MembershipServiceError("membership API returned unreadable service scopes")
    return ServiceGrant.of(scopes)


def service_context(sub: str, household_id: uuid.UUID, grant: ServiceGrant, required: frozenset[str]) -> Any:
    """Return the :class:`HouseholdContext` of a service principal admitted for ``required`` scopes.

    Raises:
        HouseholdAuthError: 403 ``household_forbidden`` when the grant lacks a required scope, or
            the route requires none.
    """
    from backend_shared.household import (
        CODE_HOUSEHOLD_FORBIDDEN,
        HouseholdAuthError,
        HouseholdContext,
        derive_user_id,
    )

    if not admits_service(required, grant.scopes):
        logger.info("Household access denied: service principal %s not admitted for household %s", sub, household_id)
        raise HouseholdAuthError(
            status.HTTP_403_FORBIDDEN, CODE_HOUSEHOLD_FORBIDDEN, "service principals may not call this endpoint"
        )
    return HouseholdContext(
        user_sub=sub,
        user_id=derive_user_id(sub),
        household_id=household_id,
        role=SERVICE_ROLE,
        scopes=grant.scopes,
    )


def require_household_access(
    *, roles: Collection[str] = (), allow_service_scopes: Collection[str] = ()
) -> Callable[..., Any]:
    """Dependency factory for routes that also admit household-bound service principals (#958).

    A member passes when ``roles`` is empty or contains their role (else 403
    ``household_role_forbidden``). A service principal passes when its binding grants every scope
    in ``allow_service_scopes`` (else 403 ``household_forbidden``). Handlers must check
    :attr:`HouseholdContext.is_service` before acting on the caller's own identity.

    Unlike :func:`~backend_shared.household.require_role` this does not build on
    :func:`~backend_shared.household.require_household`, so tests drive it with
    :func:`backend_shared.household.testing.override_membership`.
    """
    from backend_shared.household import (
        CODE_HOUSEHOLD_ROLE_FORBIDDEN,
        HOUSEHOLD_HEADER,
        HOUSEHOLD_ROLES,
        HouseholdAuthError,
        HouseholdContext,
        MembershipLookup,
        get_auth_settings,
        get_membership_lookup,
        resolve_household_context,
    )

    required = normalize_service_scopes(allow_service_scopes)
    if not required:
        raise ValueError("require_household_access() needs at least one service scope; use require_role otherwise")
    unknown = set(roles) - HOUSEHOLD_ROLES
    if unknown:
        raise ValueError(f"unknown household role(s): {sorted(unknown)}")
    allowed = frozenset(roles)

    async def _require_household_access(
        request: Request, lookup: MembershipLookup = Depends(get_membership_lookup)
    ) -> HouseholdContext:
        try:
            context = await resolve_household_context(
                request.headers.get("Authorization"),
                request.headers.get(HOUSEHOLD_HEADER),
                settings=get_auth_settings(),
                lookup=lookup,
                allow_service_scopes=required,
            )
        except HouseholdAuthError as e:
            raise e.to_http_exception()
        if not context.is_service and allowed and context.role not in allowed:
            raise HouseholdAuthError(
                status.HTTP_403_FORBIDDEN,
                CODE_HOUSEHOLD_ROLE_FORBIDDEN,
                f"this action requires one of the roles: {', '.join(sorted(allowed))}",
            ).to_http_exception()
        return context

    return _require_household_access


__all__ = ["require_household_access", "service_context", "service_grant_from_answer"]
