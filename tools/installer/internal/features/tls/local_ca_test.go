package tls

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"alfheim/installer/internal/shared/paths"
)

var caNow = time.Date(2026, 9, 17, 12, 0, 0, 0, time.UTC)

func parseCertFile(t *testing.T, path string) *x509.Certificate {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	block, _ := pem.Decode(content)
	if block == nil || block.Type != "CERTIFICATE" {
		t.Fatalf("%s is not a PEM certificate", path)
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	return cert
}

func TestEnsureLocalCAGeneratesARootCA(t *testing.T) {
	layout := paths.Layout{Root: t.TempDir()}

	ca, err := EnsureLocalCA(layout, "alfheim.example.com", caNow)
	if err != nil {
		t.Fatalf("EnsureLocalCA() error = %v", err)
	}
	if !ca.Created {
		t.Error("Created = false for a fresh install")
	}
	if ca.CertFile != layout.CaddyPKIRootCert() || ca.KeyFile != layout.CaddyPKIRootKey() ||
		ca.TrustFile != layout.TrustedCARootCert() {
		t.Errorf("paths = %+v, want the layout's", ca)
	}

	cert := parseCertFile(t, ca.CertFile)
	if !cert.IsCA || !cert.BasicConstraintsValid {
		t.Error("the root must be a CA with valid basic constraints")
	}
	if cert.KeyUsage&x509.KeyUsageCertSign == 0 || cert.KeyUsage&x509.KeyUsageCRLSign == 0 {
		t.Errorf("KeyUsage = %v, want cert and CRL signing", cert.KeyUsage)
	}
	if cert.MaxPathLen != 1 {
		t.Errorf("MaxPathLen = %d, want room for Caddy's intermediate", cert.MaxPathLen)
	}
	if want := "Alfheim Local Root CA (alfheim.example.com)"; cert.Subject.CommonName != want || ca.Subject != want {
		t.Errorf("CommonName = %q, want %q", cert.Subject.CommonName, want)
	}
	pub, ok := cert.PublicKey.(*ecdsa.PublicKey)
	if !ok || pub.Curve != elliptic.P256() {
		t.Errorf("public key = %T, want ECDSA P-256", cert.PublicKey)
	}
	if years := cert.NotAfter.Sub(caNow).Hours() / 24 / 365; years < 9.9 || years > 10.1 {
		t.Errorf("validity = %.2f years, want about 10", years)
	}
	if err := cert.CheckSignatureFrom(cert); err != nil {
		t.Errorf("the root is not self-signed: %v", err)
	}
	if ca.Fingerprint != Fingerprint(cert.Raw) || len(ca.Fingerprint) != 95 {
		t.Errorf("Fingerprint = %q", ca.Fingerprint)
	}

	for path, want := range map[string]os.FileMode{
		layout.CaddyPKIDir():  0o700,
		ca.KeyFile:            0o600,
		ca.CertFile:           0o644,
		ca.TrustFile:          0o644,
		layout.TrustedCADir(): 0o755,
	} {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if got := info.Mode().Perm(); got != want {
			t.Errorf("%s mode = %04o, want %04o", path, got, want)
		}
	}

	// The public copy is the certificate only, never the key.
	trust, err := os.ReadFile(ca.TrustFile)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(trust), "PRIVATE KEY") {
		t.Fatal("the trust copy must not contain the private key")
	}
	if parseCertFile(t, ca.TrustFile).Equal(cert) == false {
		t.Error("the trust copy differs from the root certificate")
	}
}

func TestEnsureLocalCAReusesAnExistingRoot(t *testing.T) {
	layout := paths.Layout{Root: t.TempDir()}
	first, err := EnsureLocalCA(layout, "example.com", caNow)
	if err != nil {
		t.Fatal(err)
	}
	keyBefore, err := os.ReadFile(first.KeyFile)
	if err != nil {
		t.Fatal(err)
	}

	// Loosened permissions and a lost public copy are repaired on reuse.
	if err := os.Chmod(first.KeyFile, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(layout.CaddyPKIDir(), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(first.TrustFile); err != nil {
		t.Fatal(err)
	}

	// Even a changed domain must not rotate the root.
	second, err := EnsureLocalCA(layout, "other.example.com", caNow.Add(24*time.Hour))
	if err != nil {
		t.Fatalf("second EnsureLocalCA() error = %v", err)
	}
	if second.Created {
		t.Error("Created = true, want the existing root reused")
	}
	if second.Fingerprint != first.Fingerprint {
		t.Error("the root was rotated")
	}
	keyAfter, err := os.ReadFile(second.KeyFile)
	if err != nil {
		t.Fatal(err)
	}
	if string(keyAfter) != string(keyBefore) {
		t.Error("the key was rewritten")
	}
	if info, _ := os.Stat(second.KeyFile); info.Mode().Perm() != 0o600 {
		t.Errorf("key mode = %04o, want it tightened to 0600", info.Mode().Perm())
	}
	if info, _ := os.Stat(layout.CaddyPKIDir()); info.Mode().Perm() != 0o700 {
		t.Errorf("pki dir mode = %04o, want it tightened to 0700", info.Mode().Perm())
	}
	if !parseCertFile(t, second.TrustFile).Equal(parseCertFile(t, second.CertFile)) {
		t.Error("the trust copy was not restored")
	}

	// A stale trust copy is overwritten with the real root.
	if err := os.WriteFile(second.TrustFile, []byte("stale"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := EnsureLocalCA(layout, "example.com", caNow); err != nil {
		t.Fatal(err)
	}
	if !parseCertFile(t, second.TrustFile).Equal(parseCertFile(t, second.CertFile)) {
		t.Error("a stale trust copy was not replaced")
	}
}

func TestEnsureLocalCARefusesToRotateSilently(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(t *testing.T, l paths.Layout)
		wantErr string
	}{
		{"missing key", func(t *testing.T, l paths.Layout) {
			mustRemove(t, l.CaddyPKIRootKey())
		}, "only one half"},
		{"missing cert", func(t *testing.T, l paths.Layout) {
			mustRemove(t, l.CaddyPKIRootCert())
		}, "only one half"},
		{"garbage cert", func(t *testing.T, l paths.Layout) {
			mustWrite(t, l.CaddyPKIRootCert(), "not pem")
		}, "not PEM encoded"},
		{"wrong cert block", func(t *testing.T, l paths.Layout) {
			mustWrite(t, l.CaddyPKIRootCert(), pemString("PRIVATE KEY", []byte{1}))
		}, "want \"CERTIFICATE\""},
		{"unparseable cert", func(t *testing.T, l paths.Layout) {
			mustWrite(t, l.CaddyPKIRootCert(), pemString("CERTIFICATE", []byte{1, 2, 3}))
		}, "not a valid certificate"},
		{"garbage key", func(t *testing.T, l paths.Layout) {
			mustWrite(t, l.CaddyPKIRootKey(), pemString("PRIVATE KEY", []byte{1, 2, 3}))
		}, "not a PKCS#8"},
		{"foreign key", func(t *testing.T, l paths.Layout) {
			key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
			der, _ := x509.MarshalECPrivateKey(key)
			mustWrite(t, l.CaddyPKIRootKey(), pemString("EC PRIVATE KEY", der))
		}, "does not belong"},
		{"not a CA", func(t *testing.T, l paths.Layout) {
			key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
			tpl := &x509.Certificate{SerialNumber: big.NewInt(2), Subject: pkix.Name{CommonName: "leaf"},
				NotBefore: caNow.Add(-time.Hour), NotAfter: caNow.Add(time.Hour)}
			der, _ := x509.CreateCertificate(rand.Reader, tpl, tpl, key.Public(), key)
			mustWrite(t, l.CaddyPKIRootCert(), pemString("CERTIFICATE", der))
		}, "not a certificate authority"},
		{"key path is a directory", func(t *testing.T, l paths.Layout) {
			mustRemove(t, l.CaddyPKIRootKey())
			if err := os.Mkdir(l.CaddyPKIRootKey(), 0o700); err != nil {
				t.Fatal(err)
			}
		}, "is a directory"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			layout := paths.Layout{Root: t.TempDir()}
			if _, err := EnsureLocalCA(layout, "example.com", caNow); err != nil {
				t.Fatal(err)
			}
			tc.mutate(t, layout)

			_, err := EnsureLocalCA(layout, "example.com", caNow)
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("error = %v, want it to mention %q", err, tc.wantErr)
			}
		})
	}
}

func TestEnsureLocalCARefusesAnExpiredRoot(t *testing.T) {
	layout := paths.Layout{Root: t.TempDir()}
	if _, err := EnsureLocalCA(layout, "example.com", caNow); err != nil {
		t.Fatal(err)
	}
	_, err := EnsureLocalCA(layout, "example.com", caNow.Add(LocalCAValidity+time.Hour))
	if err == nil || !strings.Contains(err.Error(), "expired") || !strings.Contains(err.Error(), "delete both") {
		t.Fatalf("error = %v, want an expiry error naming the remedy", err)
	}
}

func TestEnsureLocalCAAcceptsOtherKeyEncodings(t *testing.T) {
	for _, tc := range []struct {
		name   string
		encode func(t *testing.T) (any, []byte, string)
	}{
		{"ec", func(t *testing.T) (any, []byte, string) {
			key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
			der, _ := x509.MarshalECPrivateKey(key)
			return key, der, "EC PRIVATE KEY"
		}},
		{"pkcs1", func(t *testing.T) (any, []byte, string) {
			key, _ := rsa.GenerateKey(rand.Reader, 2048)
			return key, x509.MarshalPKCS1PrivateKey(key), "RSA PRIVATE KEY"
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			layout := paths.Layout{Root: t.TempDir()}
			if err := os.MkdirAll(layout.CaddyPKIDir(), 0o700); err != nil {
				t.Fatal(err)
			}
			key, keyDER, blockType := tc.encode(t)
			signer := key.(crypto.Signer)
			tpl := &x509.Certificate{
				SerialNumber: big.NewInt(7), Subject: pkix.Name{CommonName: "operator root"},
				NotBefore: caNow.Add(-time.Hour), NotAfter: caNow.Add(time.Hour),
				IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign,
			}
			der, err := x509.CreateCertificate(rand.Reader, tpl, tpl, signer.Public(), key)
			if err != nil {
				t.Fatal(err)
			}
			mustWrite(t, layout.CaddyPKIRootCert(), pemString("CERTIFICATE", der))
			mustWrite(t, layout.CaddyPKIRootKey(), pemString(blockType, keyDER))

			ca, err := EnsureLocalCA(layout, "example.com", caNow)
			if err != nil {
				t.Fatalf("EnsureLocalCA() error = %v", err)
			}
			if ca.Created || ca.Subject != "operator root" {
				t.Errorf("ca = %+v, want the operator's root reused", ca)
			}
		})
	}
}

func TestEnsureLocalCAReportsUnwritableRoot(t *testing.T) {
	root := t.TempDir()
	// A file where the infrastructure directory belongs.
	mustWrite(t, filepath.Join(root, "infrastructure"), "x")
	if _, err := EnsureLocalCA(paths.Layout{Root: root}, "example.com", caNow); err == nil {
		t.Fatal("EnsureLocalCA() error = nil, want a failure")
	}
}

type failingReader struct{}

func (failingReader) Read([]byte) (int, error) { return 0, errors.New("no entropy") }

func TestEnsureLocalCAReportsEntropyFailure(t *testing.T) {
	layout := paths.Layout{Root: t.TempDir()}
	if _, err := ensureLocalCA(layout, "example.com", caNow, failingReader{}); err == nil {
		t.Fatal("ensureLocalCA() error = nil, want an entropy failure")
	}
	if _, err := os.Stat(layout.CaddyPKIRootCert()); err == nil {
		t.Error("a failed generation must not leave a certificate behind")
	}
}

func TestLocalCACommonNameWithoutDomain(t *testing.T) {
	if got := LocalCACommonName(""); got != "Alfheim Local Root CA" {
		t.Errorf("LocalCACommonName(\"\") = %q", got)
	}
}

func mustRemove(t *testing.T, path string) {
	t.Helper()
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
}

func mustWrite(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func pemString(blockType string, der []byte) string {
	return string(pem.EncodeToMemory(&pem.Block{Type: blockType, Bytes: der}))
}
