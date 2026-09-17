package provisioning

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// testPKI is a private root CA plus a leaf for one host, standing in for the
// root alfheim-setup generates and the certificate Caddy issues from it.
type testPKI struct {
	rootFile string
	leaf     tls.Certificate
}

func newTestPKI(t *testing.T, host string) testPKI {
	t.Helper()
	now := time.Now()

	rootKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	rootTpl := &x509.Certificate{
		SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "Test Root"},
		NotBefore: now.Add(-time.Hour), NotAfter: now.Add(time.Hour),
		IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign,
	}
	rootDER, err := x509.CreateCertificate(rand.Reader, rootTpl, rootTpl, rootKey.Public(), rootKey)
	if err != nil {
		t.Fatal(err)
	}
	root, err := x509.ParseCertificate(rootDER)
	if err != nil {
		t.Fatal(err)
	}

	leafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	leafTpl := &x509.Certificate{
		SerialNumber: big.NewInt(2), Subject: pkix.Name{CommonName: host},
		DNSNames:  []string{host},
		NotBefore: now.Add(-time.Hour), NotAfter: now.Add(time.Hour),
		KeyUsage:    x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	leafDER, err := x509.CreateCertificate(rand.Reader, leafTpl, root, leafKey.Public(), rootKey)
	if err != nil {
		t.Fatal(err)
	}

	rootFile := filepath.Join(t.TempDir(), "root.crt")
	if err := os.WriteFile(rootFile,
		pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: rootDER}), 0o644); err != nil {
		t.Fatal(err)
	}
	return testPKI{
		rootFile: rootFile,
		leaf:     tls.Certificate{Certificate: [][]byte{leafDER}, PrivateKey: leafKey},
	}
}

// startTLSCaddy starts an HTTPS server presenting pki's leaf, reporting the
// SNI name and Host header of every request it receives.
func startTLSCaddy(t *testing.T, pki testPKI, handler http.HandlerFunc) (*httptest.Server, *[]string) {
	t.Helper()
	var seen []string
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.TLS.ServerName+"|"+r.Host+"|"+r.Header.Get("Authorization"))
		handler(w, r)
	}))
	srv.TLS = &tls.Config{Certificates: []tls.Certificate{pki.leaf}}
	srv.StartTLS()
	t.Cleanup(srv.Close)
	return srv, &seen
}

func TestEndpoint_SecureDialsLoopbackWithSNIAndCustomRoot(t *testing.T) {
	const host = "auth.alfheim.example.com"
	pki := newTestPKI(t, host)
	srv, seen := startTLSCaddy(t, pki, func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]any{"result": []any{map[string]any{"id": "proj-9"}}})
	})

	base, hc, err := Endpoint{
		Secure: true, AuthHost: host,
		// The auth host does not resolve anywhere; only the custom dial
		// can reach the server.
		TLSAddr:         srv.Listener.Addr().String(),
		ExtraRootCAFile: pki.rootFile,
	}.Client()
	if err != nil {
		t.Fatalf("Client() error = %v", err)
	}
	if base != "https://"+host {
		t.Errorf("base URL = %q, want https://%s", base, host)
	}

	c := &HTTPClient{BaseURL: base, Host: host, PAT: "pat", HTTP: hc, Clock: &noSleep{}}
	id, err := c.EnsureProject(context.Background(), "Alfheim")
	if err != nil {
		t.Fatalf("EnsureProject() over HTTPS error = %v", err)
	}
	if id != "proj-9" {
		t.Errorf("project id = %q", id)
	}
	if len(*seen) != 1 || (*seen)[0] != host+"|"+host+"|Bearer pat" {
		t.Errorf("requests = %v, want SNI and Host %s with the bearer token", *seen, host)
	}
	tr := hc.Transport.(*http.Transport)
	if tr.TLSClientConfig.InsecureSkipVerify {
		t.Error("certificate verification must never be skipped")
	}
}

func TestEndpoint_SecureRejectsAnUntrustedCertificate(t *testing.T) {
	const host = "auth.example.com"
	srv, _ := startTLSCaddy(t, newTestPKI(t, host), func(w http.ResponseWriter, r *http.Request) {
		t.Error("an untrusted server must never receive the request")
	})

	// Trust a different root than the one that signed the server.
	other := newTestPKI(t, host)
	_, hc, err := Endpoint{
		Secure: true, AuthHost: host, TLSAddr: srv.Listener.Addr().String(),
		ExtraRootCAFile: other.rootFile,
	}.Client()
	if err != nil {
		t.Fatal(err)
	}
	resp, err := hc.Get("https://" + host + "/")
	if err == nil {
		_ = resp.Body.Close()
		t.Fatal("GET succeeded against a certificate from an untrusted root")
	}
	var unknown x509.UnknownAuthorityError
	if !errors.As(err, &unknown) {
		t.Errorf("error = %v, want an unknown-authority failure", err)
	}
}

func TestEndpoint_SecureRejectsAWrongHostname(t *testing.T) {
	pki := newTestPKI(t, "auth.example.com")
	srv, _ := startTLSCaddy(t, pki, func(w http.ResponseWriter, r *http.Request) {})

	_, hc, err := Endpoint{
		Secure: true, AuthHost: "auth.other.example", TLSAddr: srv.Listener.Addr().String(),
		ExtraRootCAFile: pki.rootFile,
	}.Client()
	if err != nil {
		t.Fatal(err)
	}
	resp, err := hc.Get("https://auth.other.example/")
	if err == nil {
		_ = resp.Body.Close()
		t.Fatal("GET succeeded although the certificate names another host")
	}
}

func TestEndpoint_RedirectsAreNotFollowed(t *testing.T) {
	var hits int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		http.Redirect(w, r, "https://auth.example.com"+r.URL.Path, http.StatusPermanentRedirect)
	}))
	defer srv.Close()

	base, hc, err := Endpoint{AuthHost: "auth.example.com", PlainURL: srv.URL}.Client()
	if err != nil {
		t.Fatal(err)
	}
	if base != srv.URL {
		t.Errorf("base URL = %q, want the plain URL", base)
	}
	c := &HTTPClient{BaseURL: base, Host: "auth.example.com", PAT: "pat", HTTP: hc, Clock: &noSleep{}}
	_, err = c.EnsureProject(context.Background(), "Alfheim")
	if err == nil || !strings.Contains(err.Error(), "HTTP 308") ||
		!strings.Contains(err.Error(), "redirect not followed") {
		t.Fatalf("error = %v, want the redirect surfaced, not followed", err)
	}
	if hits != 1 {
		t.Errorf("hits = %d, want exactly one request", hits)
	}
}

func TestEndpoint_Defaults(t *testing.T) {
	base, _, err := Endpoint{}.Client()
	if err != nil || base != DefaultPlainURL {
		t.Errorf("plain Client() = %q, %v; want %q", base, err, DefaultPlainURL)
	}

	base, hc, err := Endpoint{Secure: true, AuthHost: "auth.example.com"}.Client()
	if err != nil {
		t.Fatal(err)
	}
	if base != "https://auth.example.com" {
		t.Errorf("secure base URL = %q", base)
	}
	tr := hc.Transport.(*http.Transport)
	if tr.TLSClientConfig.ServerName != "auth.example.com" || tr.Proxy != nil {
		t.Errorf("TLS config = %+v, proxy set = %t", tr.TLSClientConfig, tr.Proxy != nil)
	}
}

func TestEndpoint_SecureConfigurationErrors(t *testing.T) {
	if _, _, err := (Endpoint{Secure: true}).Client(); err == nil {
		t.Error("a secure endpoint without an auth host must fail")
	}
	if _, _, err := (Endpoint{Secure: true, AuthHost: "a.example.com",
		ExtraRootCAFile: filepath.Join(t.TempDir(), "missing.crt")}).Client(); err == nil {
		t.Error("a missing root CA file must fail")
	}
	garbage := filepath.Join(t.TempDir(), "garbage.crt")
	if err := os.WriteFile(garbage, []byte("not a certificate"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, _, err := (Endpoint{Secure: true, AuthHost: "a.example.com", ExtraRootCAFile: garbage}).Client()
	if err == nil || !strings.Contains(err.Error(), "no PEM certificate") {
		t.Errorf("error = %v, want a no-certificate failure", err)
	}
}
