"""Household membership authorization backed by the household app (``core/household``).

Zitadel only authenticates users; household membership and roles live in the
household app. Every household-scoped request therefore:

1. validates the end-user JWT with :func:`backend_shared.dependencies.decode_oidc_token`,
2. reads the requested household from the ``X-Household-ID`` header,
3. asks the household app's internal membership API whether the JWT ``sub`` is a
   member of that household (and with which role),
4. yields a :class:`HouseholdContext`.

HTTP routes use the :func:`require_household` FastAPI dependency (plus
:func:`require_role` for role checks); the MCP endpoint uses
:class:`backend_shared.mcp_middleware.MCPAuthenticationMiddleware`, which runs the
exact same resolution (:func:`resolve_household_context`).

Environment:

* ``HOUSEHOLD_INTERNAL_URL`` (default ``http://household-backend:8080``)
* ``ALFHEIM_INTERNAL_TOKEN`` (required outside test contexts)

Failures never fail open: an unreachable/erroring membership service yields 503.
"""

import asyncio
import logging
import os
import time
import uuid
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Literal, Protocol, get_args
from urllib.parse import quote, urlparse

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

from backend_shared.dependencies import decode_oidc_token, is_mock_auth_allowed
from backend_shared.tls import ExtraCAError, get_oidc_ssl_context

logger = logging.getLogger(__name__)

HouseholdRole = Literal["OWNER", "ADMIN", "MEMBER", "GUEST"]
HOUSEHOLD_ROLES: frozenset[str] = frozenset(get_args(HouseholdRole))

HOUSEHOLD_HEADER = "X-Household-ID"
HOUSEHOLD_INTERNAL_URL_ENV = "HOUSEHOLD_INTERNAL_URL"
INTERNAL_TOKEN_ENV = "ALFHEIM_INTERNAL_TOKEN"
DEFAULT_HOUSEHOLD_INTERNAL_URL = "http://household-backend:8080"

POSITIVE_CACHE_TTL_SECONDS = 30.0
NEGATIVE_CACHE_TTL_SECONDS = 5.0
REQUEST_TIMEOUT_SECONDS = 2.0
_MAX_CACHE_ENTRIES = 10_000

# Error codes (``{"detail": {"code": ..., "message": ...}}``).
CODE_UNAUTHENTICATED = "unauthenticated"
CODE_HOUSEHOLD_REQUIRED = "household_required"
CODE_HOUSEHOLD_INVALID = "household_invalid"
CODE_HOUSEHOLD_FORBIDDEN = "household_forbidden"
CODE_HOUSEHOLD_ROLE_FORBIDDEN = "household_role_forbidden"
CODE_HOUSEHOLD_SERVICE_UNAVAILABLE = "household_service_unavailable"


@dataclass(frozen=True, slots=True)
class HouseholdContext:
    """Authenticated user plus the household they are acting in, as confirmed by the household app."""

    user_sub: str
    """Raw JWT ``sub`` claim (the Zitadel user id)."""
    user_id: uuid.UUID
    """UUID derived from ``sub`` (see :func:`derive_user_id`); matches existing ``user_id`` columns."""
    household_id: uuid.UUID
    role: HouseholdRole
    email: str | None = None
    username: str | None = None


def derive_user_id(sub: str) -> uuid.UUID:
    """Map a JWT ``sub`` to the user UUID stored by the apps.

    UUID subjects are used as-is, anything else (e.g. Zitadel's numeric ids) is
    hashed with ``uuid5(NAMESPACE_DNS, sub)`` so existing rows keep matching.
    """
    try:
        return uuid.UUID(sub)
    except ValueError:
        return uuid.uuid5(uuid.NAMESPACE_DNS, sub)


class HouseholdAuthError(Exception):
    """A request could not be authorized for a household. Carries the HTTP error contract."""

    def __init__(self, status_code: int, code: str, message: str, headers: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.headers = headers

    @property
    def detail(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message}

    def to_http_exception(self) -> HTTPException:
        return HTTPException(status_code=self.status_code, detail=self.detail, headers=self.headers)

    def to_response(self) -> JSONResponse:
        return JSONResponse(status_code=self.status_code, content={"detail": self.detail}, headers=self.headers)


class HouseholdConfigError(RuntimeError):
    """Raised when the membership client is misconfigured (e.g. ``ALFHEIM_INTERNAL_TOKEN`` missing)."""


class MembershipServiceError(Exception):
    """The membership API could not give a definitive answer (unreachable, timeout, 5xx, bad token, ...)."""


class MembershipLookup(Protocol):
    """Resolves a user's role in a household. Returns ``None`` when the user is not a member.

    Raises :class:`MembershipServiceError` when no definitive answer is possible.
    """

    async def __call__(self, household_id: uuid.UUID, user_sub: str) -> HouseholdRole | None: ...


def _is_test_context() -> bool:
    return is_mock_auth_allowed(None)


class HouseholdMembershipClient:
    """Cached client for ``GET /internal/v1/memberships/{householdId}/{userSub}``.

    Positive answers are cached for 30 s, "not a member" for 5 s, keyed by
    ``(household_id, user_sub)``. Errors are never cached. One underlying
    ``httpx.AsyncClient`` is kept per event loop.
    """

    def __init__(
        self,
        base_url: str | None = None,
        token: str | None = None,
        *,
        timeout: float = REQUEST_TIMEOUT_SECONDS,
        positive_ttl: float = POSITIVE_CACHE_TTL_SECONDS,
        negative_ttl: float = NEGATIVE_CACHE_TTL_SECONDS,
        transport: httpx.AsyncBaseTransport | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._base_url = base_url
        self._token = token
        self._timeout = timeout
        self._positive_ttl = positive_ttl
        self._negative_ttl = negative_ttl
        self._transport = transport
        self._clock = clock
        self._cache: dict[tuple[uuid.UUID, str], tuple[float, HouseholdRole | None]] = {}
        self._client: httpx.AsyncClient | None = None
        self._client_loop: asyncio.AbstractEventLoop | None = None

    @property
    def base_url(self) -> str:
        url = self._base_url or os.getenv(HOUSEHOLD_INTERNAL_URL_ENV) or DEFAULT_HOUSEHOLD_INTERNAL_URL
        return url.strip().rstrip("/")

    def internal_token(self) -> str | None:
        """Return the internal token, raising :class:`HouseholdConfigError` if it is missing outside tests."""
        token = (self._token if self._token is not None else os.getenv(INTERNAL_TOKEN_ENV, "")).strip()
        if token:
            return token
        if _is_test_context():
            return None
        raise HouseholdConfigError(
            f"{INTERNAL_TOKEN_ENV} is not set: backends cannot query household memberships. "
            "Set it to the same value as the household app's internal token."
        )

    def validate_config(self) -> None:
        """Fail loudly (at startup) when the configuration is unusable."""
        self.internal_token()
        parsed = urlparse(self.base_url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise HouseholdConfigError(f"{HOUSEHOLD_INTERNAL_URL_ENV} is not a valid http(s) URL: {self.base_url!r}")

    def clear_cache(self) -> None:
        self._cache.clear()

    def _http_client(self) -> httpx.AsyncClient:
        loop = asyncio.get_running_loop()
        if self._client is None or self._client_loop is not loop or self._client.is_closed:
            verify: Any = True
            if self.base_url.startswith("https://"):
                verify = get_oidc_ssl_context() or True
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self._timeout),
                transport=self._transport,
                verify=verify,
            )
            self._client_loop = loop
        return self._client

    async def aclose(self) -> None:
        client, self._client, self._client_loop = self._client, None, None
        if client is not None and not client.is_closed:
            await client.aclose()

    def _cache_get(self, key: tuple[uuid.UUID, str]) -> tuple[bool, HouseholdRole | None]:
        entry = self._cache.get(key)
        if entry is None:
            return False, None
        expires_at, role = entry
        if expires_at <= self._clock():
            self._cache.pop(key, None)
            return False, None
        return True, role

    def _cache_put(self, key: tuple[uuid.UUID, str], role: HouseholdRole | None) -> None:
        now = self._clock()
        if len(self._cache) >= _MAX_CACHE_ENTRIES:
            self._cache = {k: v for k, v in self._cache.items() if v[0] > now}
            if len(self._cache) >= _MAX_CACHE_ENTRIES:
                self._cache.clear()
        ttl = self._positive_ttl if role is not None else self._negative_ttl
        self._cache[key] = (now + ttl, role)

    async def __call__(self, household_id: uuid.UUID, user_sub: str) -> HouseholdRole | None:
        key = (household_id, user_sub)
        hit, role = self._cache_get(key)
        if hit:
            return role
        role = await self._fetch(household_id, user_sub)
        self._cache_put(key, role)
        return role

    async def _fetch(self, household_id: uuid.UUID, user_sub: str) -> HouseholdRole | None:
        try:
            token = self.internal_token()
            client = self._http_client()
        except (HouseholdConfigError, ExtraCAError) as e:
            logger.error("Household membership client misconfigured: %s", e)
            raise MembershipServiceError(str(e)) from e

        url = f"{self.base_url}/internal/v1/memberships/{household_id}/{quote(user_sub, safe='')}"
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        try:
            response = await client.get(url, headers=headers)
        except httpx.HTTPError as e:
            logger.error("Household membership API unreachable (%s): %s", type(e).__name__, e)
            raise MembershipServiceError(f"membership API unreachable: {type(e).__name__}") from e

        if response.status_code == status.HTTP_404_NOT_FOUND:
            return None
        if response.status_code == status.HTTP_200_OK:
            try:
                role = response.json().get("role")
            except (ValueError, AttributeError) as e:
                logger.error("Household membership API returned an unreadable body: %s", e)
                raise MembershipServiceError("membership API returned an unreadable body") from e
            if role not in HOUSEHOLD_ROLES:
                logger.error("Household membership API returned an unknown role: %r", role)
                raise MembershipServiceError(f"membership API returned an unknown role: {role!r}")
            return role
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            logger.error(
                "Household membership API rejected %s (check that both sides share the token)", INTERNAL_TOKEN_ENV
            )
        else:
            logger.error("Household membership API answered HTTP %s", response.status_code)
        raise MembershipServiceError(f"membership API answered HTTP {response.status_code}")


# --------------------------------------------------------------------------- process-wide state

_default_client: HouseholdMembershipClient | None = None
_auth_settings: Any = None


def get_membership_client() -> HouseholdMembershipClient:
    """Return the process-wide membership client (created on first use from the environment)."""
    global _default_client
    if _default_client is None:
        _default_client = HouseholdMembershipClient()
    return _default_client


async def close_membership_client() -> None:
    """Close the process-wide client's connections (call from the app lifespan shutdown)."""
    global _default_client
    client, _default_client = _default_client, None
    if client is not None:
        await client.aclose()


def configure_household_auth(settings: Any, *, validate: bool = True) -> None:
    """Register the app's OIDC settings used to validate JWTs in :func:`require_household`.

    Call once at startup (e.g. in ``main.py``). With ``validate=True`` (default)
    a missing ``ALFHEIM_INTERNAL_TOKEN`` outside tests raises
    :class:`HouseholdConfigError` immediately instead of on the first request.
    """
    global _auth_settings
    _auth_settings = settings
    if validate:
        get_membership_client().validate_config()


def get_auth_settings() -> Any:
    """Return the settings registered with :func:`configure_household_auth` (``None`` if never called)."""
    return _auth_settings


def get_membership_lookup() -> MembershipLookup:
    """FastAPI dependency returning the membership lookup. Override it in tests (see ``.testing``)."""
    return get_membership_client()


# --------------------------------------------------------------------------- resolution


def _unauthenticated(message: str) -> HouseholdAuthError:
    return HouseholdAuthError(
        status.HTTP_401_UNAUTHORIZED, CODE_UNAUTHENTICATED, message, headers={"WWW-Authenticate": "Bearer"}
    )


def authenticate(authorization: str | None, settings: Any = None) -> dict[str, Any]:
    """Validate the ``Authorization: Bearer`` header and return the JWT claims (requires ``sub``)."""
    if not authorization:
        raise _unauthenticated("missing authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise _unauthenticated("invalid authorization header format")
    try:
        payload = decode_oidc_token(parts[1], settings=settings)
    except HTTPException as e:
        raise _unauthenticated(str(e.detail))
    if not isinstance(payload.get("sub"), str) or not payload["sub"]:
        raise _unauthenticated("missing sub claim in token")
    return payload


def parse_household_header(value: str | None) -> uuid.UUID:
    """Parse ``X-Household-ID``: missing -> 400 ``household_required``, not a UUID -> 400 ``household_invalid``."""
    if value is None or not value.strip():
        raise HouseholdAuthError(
            status.HTTP_400_BAD_REQUEST, CODE_HOUSEHOLD_REQUIRED, f"the {HOUSEHOLD_HEADER} header is required"
        )
    try:
        return uuid.UUID(value.strip())
    except ValueError:
        raise HouseholdAuthError(
            status.HTTP_400_BAD_REQUEST, CODE_HOUSEHOLD_INVALID, f"the {HOUSEHOLD_HEADER} header must be a UUID"
        )


async def resolve_household_context(
    authorization: str | None,
    household_header: str | None,
    *,
    settings: Any = None,
    lookup: MembershipLookup | None = None,
) -> HouseholdContext:
    """Authenticate the caller and confirm their membership. Raises :class:`HouseholdAuthError`."""
    payload = authenticate(authorization, settings=settings)
    household_id = parse_household_header(household_header)
    sub: str = payload["sub"]

    membership = lookup if lookup is not None else get_membership_client()
    try:
        role = await membership(household_id, sub)
    except MembershipServiceError:
        raise HouseholdAuthError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            CODE_HOUSEHOLD_SERVICE_UNAVAILABLE,
            "household membership could not be verified, try again later",
        )
    if role is None:
        logger.info("Household access denied: sub %s is not a member of household %s", sub, household_id)
        raise HouseholdAuthError(
            status.HTTP_403_FORBIDDEN, CODE_HOUSEHOLD_FORBIDDEN, "you are not a member of this household"
        )

    email = payload.get("email")
    username = payload.get("preferred_username")
    return HouseholdContext(
        user_sub=sub,
        user_id=derive_user_id(sub),
        household_id=household_id,
        role=role,
        email=email if isinstance(email, str) else None,
        username=username if isinstance(username, str) else None,
    )


# --------------------------------------------------------------------------- FastAPI dependencies


async def require_household(
    request: Request,
    lookup: MembershipLookup = Depends(get_membership_lookup),
) -> HouseholdContext:
    """FastAPI dependency: authenticated user + confirmed household membership.

    Errors (``{"detail": {"code", "message"}}``): 401 ``unauthenticated``,
    400 ``household_required`` / ``household_invalid``, 403 ``household_forbidden``,
    503 ``household_service_unavailable``.
    """
    try:
        return await resolve_household_context(
            request.headers.get("Authorization"),
            request.headers.get(HOUSEHOLD_HEADER),
            settings=_auth_settings,
            lookup=lookup,
        )
    except HouseholdAuthError as e:
        raise e.to_http_exception()


def require_role(*roles: HouseholdRole) -> Callable[..., Any]:
    """Dependency factory: like :func:`require_household` but also requires one of ``roles``.

    Responds 403 ``household_role_forbidden`` when the member's role is not allowed.
    """
    if not roles:
        raise ValueError("require_role() needs at least one role")
    unknown = set(roles) - HOUSEHOLD_ROLES
    if unknown:
        raise ValueError(f"unknown household role(s): {sorted(unknown)}")
    allowed = frozenset(roles)

    async def _require_role(context: HouseholdContext = Depends(require_household)) -> HouseholdContext:
        if context.role not in allowed:
            raise HouseholdAuthError(
                status.HTTP_403_FORBIDDEN,
                CODE_HOUSEHOLD_ROLE_FORBIDDEN,
                f"this action requires one of the roles: {', '.join(sorted(allowed))}",
            ).to_http_exception()
        return context

    return _require_role


def normalize_memberships(
    memberships: Mapping[tuple[uuid.UUID | str, str], HouseholdRole],
) -> dict[tuple[uuid.UUID, str], HouseholdRole]:
    """Normalize ``{(household_id, sub): role}`` keys to ``(UUID, str)`` and validate roles."""
    normalized: dict[tuple[uuid.UUID, str], HouseholdRole] = {}
    for (household_id, sub), role in memberships.items():
        if role not in HOUSEHOLD_ROLES:
            raise ValueError(f"unknown household role: {role!r}")
        hh = household_id if isinstance(household_id, uuid.UUID) else uuid.UUID(household_id)
        normalized[(hh, sub)] = role
    return normalized


__all__ = [
    "CODE_HOUSEHOLD_FORBIDDEN",
    "CODE_HOUSEHOLD_INVALID",
    "CODE_HOUSEHOLD_REQUIRED",
    "CODE_HOUSEHOLD_ROLE_FORBIDDEN",
    "CODE_HOUSEHOLD_SERVICE_UNAVAILABLE",
    "CODE_UNAUTHENTICATED",
    "DEFAULT_HOUSEHOLD_INTERNAL_URL",
    "HOUSEHOLD_HEADER",
    "HOUSEHOLD_ROLES",
    "HouseholdAuthError",
    "HouseholdConfigError",
    "HouseholdContext",
    "HouseholdMembershipClient",
    "HouseholdRole",
    "MembershipLookup",
    "MembershipServiceError",
    "authenticate",
    "close_membership_client",
    "configure_household_auth",
    "derive_user_id",
    "get_auth_settings",
    "get_membership_client",
    "get_membership_lookup",
    "normalize_memberships",
    "parse_household_header",
    "require_household",
    "require_role",
    "resolve_household_context",
]
