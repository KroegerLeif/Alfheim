"""TLS trust for server-side calls to the OIDC issuer.

Installs using ``--tls internal`` serve the issuer with a certificate signed by
a private root CA the installer generates. Containers do not trust that root
out of the box, so ``ALFHEIM_EXTRA_CA_FILE`` may point at a PEM bundle whose
certificates are added on top of the default trust store (never replacing it).
When the variable is unset or empty, callers get ``None`` and keep their
library defaults unchanged.
"""

import logging
import os
import ssl
from functools import lru_cache

import certifi

logger = logging.getLogger(__name__)

EXTRA_CA_FILE_ENV = "ALFHEIM_EXTRA_CA_FILE"


class ExtraCAError(RuntimeError):
    """Raised when ``ALFHEIM_EXTRA_CA_FILE`` is set but cannot be loaded."""


def extra_ca_file() -> str | None:
    """Return the configured extra CA bundle path, or ``None`` when unset or blank."""
    value = (os.getenv(EXTRA_CA_FILE_ENV) or "").strip()
    return value or None


@lru_cache(maxsize=1)
def get_oidc_ssl_context() -> ssl.SSLContext | None:
    """Return a cached SSL context trusting the default roots plus the extra CA bundle.

    Returns ``None`` when no extra CA is configured so callers keep their
    library defaults. Raises ``ExtraCAError`` when the variable is set but the
    file is missing or not a valid PEM bundle: silently falling back would only
    surface later as an opaque certificate verification failure.
    """
    ca_file = extra_ca_file()
    if ca_file is None:
        return None

    # System store plus certifi covers what both PyJWT (urllib) and httpx trusted before.
    context = ssl.create_default_context()
    context.load_verify_locations(cafile=certifi.where())
    try:
        context.load_verify_locations(cafile=ca_file)
    except (OSError, ssl.SSLError) as e:
        logger.error("Cannot load extra CA bundle from %s=%s: %s", EXTRA_CA_FILE_ENV, ca_file, e)
        raise ExtraCAError(f"{EXTRA_CA_FILE_ENV} is set to {ca_file!r} but it could not be loaded: {e}") from e

    logger.info("Trusting extra CA bundle %s for OIDC calls", ca_file)
    return context
