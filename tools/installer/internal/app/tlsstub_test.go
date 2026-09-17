package app

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	cryptotls "crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"alfheim/installer/internal/features/tls"
	"alfheim/installer/internal/shared/paths"
)

// startSecureZitadel stands in for Caddy's HTTPS listener in front of
// Zitadel on an internal-strategy install: it generates the installation's
// root CA exactly like alfheim-setup does, serves a leaf for host signed by
// that root, and returns the listener address to dial. Nothing but the
// generated root makes the certificate trusted, so a passing request proves
// the provisioning transport trusts it and verifies the host name.
func startSecureZitadel(t *testing.T, layout paths.Layout, host string, handler http.Handler) string {
	t.Helper()
	ca, err := tls.EnsureLocalCA(layout, "example.com", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	root := readPEMBlock(t, ca.CertFile)
	rootCert, err := x509.ParseCertificate(root)
	if err != nil {
		t.Fatal(err)
	}
	rootKeyAny, err := x509.ParsePKCS8PrivateKey(readPEMBlock(t, ca.KeyFile))
	if err != nil {
		t.Fatal(err)
	}
	rootKey := rootKeyAny.(crypto.Signer)

	leafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	leafDER, err := x509.CreateCertificate(rand.Reader, &x509.Certificate{
		SerialNumber: big.NewInt(42), Subject: pkix.Name{CommonName: host}, DNSNames: []string{host},
		NotBefore: now.Add(-time.Hour), NotAfter: now.Add(time.Hour),
		KeyUsage:    x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}, rootCert, leafKey.Public(), rootKey)
	if err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewUnstartedServer(handler)
	srv.TLS = &cryptotls.Config{Certificates: []cryptotls.Certificate{{
		Certificate: [][]byte{leafDER}, PrivateKey: leafKey,
	}}}
	srv.StartTLS()
	t.Cleanup(srv.Close)
	return srv.Listener.Addr().String()
}

func readPEMBlock(t *testing.T, path string) []byte {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	block, _ := pem.Decode(content)
	if block == nil {
		t.Fatalf("%s is not PEM", path)
	}
	return block.Bytes
}
