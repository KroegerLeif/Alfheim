"""Unit tests for the extra root CA trust used by server-side OIDC calls."""

import datetime
from unittest.mock import MagicMock, patch

import pytest
from backend_shared import dependencies, oidc_discovery, tls
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

CA_COMMON_NAME = "Alfheim Test Root CA"


def _write_root_ca(path) -> None:
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, CA_COMMON_NAME)])
    now = datetime.datetime.now(datetime.UTC)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=1))
        .not_valid_after(now + datetime.timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))


def _subject_common_names(context) -> set[str]:
    names = set()
    for cert in context.get_ca_certs():
        for rdn in cert.get("subject", ()):
            for key, value in rdn:
                if key == "commonName":
                    names.add(value)
    return names


@pytest.fixture(autouse=True)
def _clear_context_cache():
    tls.get_oidc_ssl_context.cache_clear()
    dependencies._jwks_clients.clear()
    oidc_discovery._discovered_jwks_uris.clear()
    yield
    tls.get_oidc_ssl_context.cache_clear()
    dependencies._jwks_clients.clear()
    oidc_discovery._discovered_jwks_uris.clear()


def test_unset_extra_ca_keeps_library_defaults(monkeypatch):
    monkeypatch.delenv(tls.EXTRA_CA_FILE_ENV, raising=False)
    assert tls.get_oidc_ssl_context() is None


def test_blank_extra_ca_keeps_library_defaults(monkeypatch):
    monkeypatch.setenv(tls.EXTRA_CA_FILE_ENV, "  ")
    assert tls.get_oidc_ssl_context() is None


def test_extra_ca_is_added_to_default_roots(monkeypatch, tmp_path):
    ca_file = tmp_path / "alfheim-root-ca.crt"
    _write_root_ca(ca_file)
    monkeypatch.setenv(tls.EXTRA_CA_FILE_ENV, str(ca_file))

    context = tls.get_oidc_ssl_context()

    assert context is not None
    names = _subject_common_names(context)
    assert CA_COMMON_NAME in names
    # The certifi roots are still present: public endpoints keep working.
    assert len(names) > 1
    assert tls.get_oidc_ssl_context() is context


def test_missing_extra_ca_file_fails_loudly(monkeypatch, tmp_path):
    monkeypatch.setenv(tls.EXTRA_CA_FILE_ENV, str(tmp_path / "missing.crt"))
    with pytest.raises(tls.ExtraCAError, match="missing.crt"):
        tls.get_oidc_ssl_context()


def test_invalid_extra_ca_file_fails_loudly(monkeypatch, tmp_path):
    ca_file = tmp_path / "garbage.crt"
    ca_file.write_text("not a certificate")
    monkeypatch.setenv(tls.EXTRA_CA_FILE_ENV, str(ca_file))
    with pytest.raises(tls.ExtraCAError, match="garbage.crt"):
        tls.get_oidc_ssl_context()


def test_jwks_client_uses_extra_ca_context(monkeypatch, tmp_path):
    ca_file = tmp_path / "alfheim-root-ca.crt"
    _write_root_ca(ca_file)
    monkeypatch.setenv(tls.EXTRA_CA_FILE_ENV, str(ca_file))

    client = dependencies.get_jwks_client("https://auth.example.test/oauth/v2/keys")

    assert client.ssl_context is tls.get_oidc_ssl_context()


def test_discovery_uses_extra_ca_context(monkeypatch, tmp_path):
    ca_file = tmp_path / "alfheim-root-ca.crt"
    _write_root_ca(ca_file)
    monkeypatch.setenv(tls.EXTRA_CA_FILE_ENV, str(ca_file))

    response = MagicMock()
    response.json.return_value = {"jwks_uri": "https://auth.example.test/oauth/v2/keys"}
    with patch("httpx.Client") as mock_client:
        mock_client.return_value.__enter__.return_value.get.return_value = response
        assert oidc_discovery.get_jwks_uri("https://auth.example.test") == "https://auth.example.test/oauth/v2/keys"

    assert mock_client.call_args.kwargs["verify"] is tls.get_oidc_ssl_context()


def test_discovery_with_broken_extra_ca_is_not_masked_as_401(monkeypatch, tmp_path):
    monkeypatch.setenv(tls.EXTRA_CA_FILE_ENV, str(tmp_path / "missing.crt"))
    with pytest.raises(tls.ExtraCAError):
        oidc_discovery.get_jwks_uri("https://auth.example.test")
