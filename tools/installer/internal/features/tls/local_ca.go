package tls

import (
	"bytes"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"math/big"
	"os"
	"strings"
	"time"

	"alfheim/installer/internal/shared/paths"
)

// LocalCAValidity is how long a generated root certificate authority lives.
// It is long on purpose: every browser and host that imported the root would
// have to import a new one after it expires.
const LocalCAValidity = 10 * 365 * 24 * time.Hour

// LocalCAContainerTrustFile is where backends see the public copy of the root
// certificate (ALFHEIM_EXTRA_CA_FILE), through compose.prod.yaml's read-only
// ./infrastructure/ca:/etc/alfheim/ca bind mount.
const LocalCAContainerTrustFile = "/etc/alfheim/ca/alfheim-root-ca.crt"

// LocalCA describes the root certificate authority the internal strategy
// signs every site certificate with.
type LocalCA struct {
	// CertFile and KeyFile are the host paths Caddy reads (read-only mount
	// at /etc/caddy/pki).
	CertFile string
	KeyFile  string
	// TrustFile is the public copy for backends, browsers and OS stores.
	TrustFile string
	// Subject is the root certificate's common name.
	Subject string
	// NotAfter is when the root expires.
	NotAfter time.Time
	// Fingerprint is the SHA-256 digest of the DER certificate, rendered as
	// colon-separated upper-case hex the way browsers display it.
	Fingerprint string
	// Created reports whether this run generated the root, as opposed to
	// reusing one an earlier run left behind.
	Created bool
}

// EnsureLocalCA returns the installation's root certificate authority,
// generating it when none exists yet. An existing, valid root is always
// reused: rotating it would silently invalidate every trust store it was
// imported into. A half-present or unusable root is an error with an
// explicit remedy rather than a silent replacement.
func EnsureLocalCA(layout paths.Layout, baseDomain string, now time.Time) (LocalCA, error) {
	return ensureLocalCA(layout, baseDomain, now, rand.Reader)
}

func ensureLocalCA(layout paths.Layout, baseDomain string, now time.Time, entropy io.Reader) (LocalCA, error) {
	ca := LocalCA{
		CertFile:  layout.CaddyPKIRootCert(),
		KeyFile:   layout.CaddyPKIRootKey(),
		TrustFile: layout.TrustedCARootCert(),
	}

	if err := os.MkdirAll(layout.CaddyPKIDir(), 0o700); err != nil {
		return ca, fmt.Errorf("tls: create %s: %w", layout.CaddyPKIDir(), err)
	}
	// MkdirAll leaves an existing directory's mode alone.
	if err := os.Chmod(layout.CaddyPKIDir(), 0o700); err != nil {
		return ca, fmt.Errorf("tls: restrict %s: %w", layout.CaddyPKIDir(), err)
	}

	certExists, err := fileExists(ca.CertFile)
	if err != nil {
		return ca, err
	}
	keyExists, err := fileExists(ca.KeyFile)
	if err != nil {
		return ca, err
	}

	var certDER []byte
	switch {
	case certExists && keyExists:
		certDER, err = loadLocalCA(ca.CertFile, ca.KeyFile, now)
		if err != nil {
			return ca, fmt.Errorf("%w; the root was left untouched on purpose, because replacing it "+
				"invalidates every trust store it was imported into — delete both %s and %s "+
				"to generate a new one", err, ca.CertFile, ca.KeyFile)
		}
		if err := os.Chmod(ca.KeyFile, 0o600); err != nil {
			return ca, fmt.Errorf("tls: restrict %s: %w", ca.KeyFile, err)
		}
	case certExists != keyExists:
		return ca, fmt.Errorf("tls: only one half of the local root CA exists (%s: %t, %s: %t); "+
			"restore the missing file, or delete the other one to generate a new root",
			ca.CertFile, certExists, ca.KeyFile, keyExists)
	default:
		certDER, err = generateLocalCA(ca.CertFile, ca.KeyFile, baseDomain, now, entropy)
		if err != nil {
			return ca, err
		}
		ca.Created = true
	}

	if err := writeTrustCopy(layout, ca.TrustFile, certDER); err != nil {
		return ca, err
	}

	cert, err := x509.ParseCertificate(certDER)
	if err != nil {
		return ca, fmt.Errorf("tls: parse local root CA: %w", err)
	}
	ca.Subject = cert.Subject.CommonName
	ca.NotAfter = cert.NotAfter
	ca.Fingerprint = Fingerprint(certDER)
	return ca, nil
}

// LocalCACommonName names the root after the installation, so an operator
// can tell several imported Alfheim roots apart in a trust store.
func LocalCACommonName(baseDomain string) string {
	if baseDomain == "" {
		return "Alfheim Local Root CA"
	}
	return fmt.Sprintf("Alfheim Local Root CA (%s)", baseDomain)
}

// Fingerprint renders the SHA-256 digest of a DER certificate as
// colon-separated upper-case hex.
func Fingerprint(der []byte) string {
	sum := sha256.Sum256(der)
	raw := strings.ToUpper(hex.EncodeToString(sum[:]))
	parts := make([]string, 0, len(sum))
	for i := 0; i < len(raw); i += 2 {
		parts = append(parts, raw[i:i+2])
	}
	return strings.Join(parts, ":")
}

// generateLocalCA creates an ECDSA P-256 root and writes the key (0600)
// before the certificate, so an interrupted run never leaves a certificate
// without its key.
func generateLocalCA(certFile, keyFile, baseDomain string, now time.Time, entropy io.Reader) ([]byte, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), entropy)
	if err != nil {
		return nil, fmt.Errorf("tls: generate local root CA key: %w", err)
	}
	serial, err := rand.Int(entropy, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, fmt.Errorf("tls: generate local root CA serial: %w", err)
	}

	template := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName:   LocalCACommonName(baseDomain),
			Organization: []string{"Alfheim"},
		},
		// Tolerate modest clock skew between this host and its clients.
		NotBefore:             now.Add(-time.Hour).UTC(),
		NotAfter:              now.Add(LocalCAValidity).UTC(),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
		// Caddy signs leaves through an intermediate of its own, so exactly
		// one CA may sit below this root.
		MaxPathLen: 1,
	}
	der, err := x509.CreateCertificate(entropy, template, template, key.Public(), key)
	if err != nil {
		return nil, fmt.Errorf("tls: create local root CA certificate: %w", err)
	}

	pkcs8, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return nil, fmt.Errorf("tls: encode local root CA key: %w", err)
	}
	if err := writePEM(keyFile, "PRIVATE KEY", pkcs8, 0o600); err != nil {
		return nil, err
	}
	if err := writePEM(certFile, "CERTIFICATE", der, 0o644); err != nil {
		return nil, err
	}
	return der, nil
}

// loadLocalCA checks an existing root: a parseable CA certificate that may
// sign certificates, is currently valid and matches its private key.
func loadLocalCA(certFile, keyFile string, now time.Time) ([]byte, error) {
	certDER, err := readPEM(certFile, "CERTIFICATE")
	if err != nil {
		return nil, err
	}
	cert, err := x509.ParseCertificate(certDER)
	if err != nil {
		return nil, fmt.Errorf("tls: local root CA %s is not a valid certificate: %w", certFile, err)
	}
	if !cert.IsCA || cert.KeyUsage&x509.KeyUsageCertSign == 0 {
		return nil, fmt.Errorf("tls: %s is not a certificate authority allowed to sign certificates", certFile)
	}
	if now.After(cert.NotAfter) {
		return nil, fmt.Errorf("tls: local root CA %s expired on %s", certFile, cert.NotAfter.Format(time.DateOnly))
	}

	keyDER, err := readPEM(keyFile, "")
	if err != nil {
		return nil, err
	}
	key, err := parsePrivateKey(keyDER)
	if err != nil {
		return nil, fmt.Errorf("tls: local root CA key %s: %w", keyFile, err)
	}
	pub, ok := key.Public().(interface{ Equal(crypto.PublicKey) bool })
	if !ok || !pub.Equal(cert.PublicKey) {
		return nil, fmt.Errorf("tls: local root CA key %s does not belong to %s", keyFile, certFile)
	}
	return certDER, nil
}

// parsePrivateKey accepts the encodings Caddy itself reads.
func parsePrivateKey(der []byte) (crypto.Signer, error) {
	if key, err := x509.ParsePKCS8PrivateKey(der); err == nil {
		if signer, ok := key.(crypto.Signer); ok {
			return signer, nil
		}
	}
	if key, err := x509.ParseECPrivateKey(der); err == nil {
		return key, nil
	}
	if key, err := x509.ParsePKCS1PrivateKey(der); err == nil {
		return key, nil
	}
	return nil, errors.New("not a PKCS#8, EC or PKCS#1 private key")
}

// writeTrustCopy keeps the public copy in step with the root. The copy is
// derived data, so rewriting it is always safe.
func writeTrustCopy(layout paths.Layout, trustFile string, der []byte) error {
	if err := os.MkdirAll(layout.TrustedCADir(), 0o755); err != nil {
		return fmt.Errorf("tls: create %s: %w", layout.TrustedCADir(), err)
	}
	want := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	if current, err := os.ReadFile(trustFile); err == nil && bytes.Equal(current, want) {
		return os.Chmod(trustFile, 0o644)
	}
	return writePEM(trustFile, "CERTIFICATE", der, 0o644)
}

func writePEM(path, blockType string, der []byte, perm os.FileMode) error {
	content := pem.EncodeToMemory(&pem.Block{Type: blockType, Bytes: der})
	if err := os.WriteFile(path, content, perm); err != nil {
		return fmt.Errorf("tls: write %s: %w", path, err)
	}
	// WriteFile keeps an existing file's mode.
	if err := os.Chmod(path, perm); err != nil {
		return fmt.Errorf("tls: set permissions on %s: %w", path, err)
	}
	return nil
}

// readPEM returns the first PEM block of a file, optionally requiring a type.
func readPEM(path, blockType string) ([]byte, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("tls: read %s: %w", path, err)
	}
	block, _ := pem.Decode(content)
	if block == nil {
		return nil, fmt.Errorf("tls: %s is not PEM encoded", path)
	}
	if blockType != "" && block.Type != blockType {
		return nil, fmt.Errorf("tls: %s holds a %q PEM block, want %q", path, block.Type, blockType)
	}
	return block.Bytes, nil
}

func fileExists(path string) (bool, error) {
	info, err := os.Stat(path)
	switch {
	case err == nil:
		if info.IsDir() {
			return false, fmt.Errorf("tls: %s is a directory, not a file", path)
		}
		return true, nil
	case errors.Is(err, fs.ErrNotExist):
		return false, nil
	default:
		return false, fmt.Errorf("tls: inspect %s: %w", path, err)
	}
}
