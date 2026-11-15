package security

import (
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
)

// maxPrivateKeyBytes is Zitadel's limit for an uploaded Apple key
// (AddAppleProviderRequest.private_key, max_len 5000).
const maxPrivateKeyBytes = 5000

// ReadPrivateKeyFile reads a PEM-encoded PKCS #8 EC private key, such as the
// .p8 key Apple issues for Sign in with Apple, from path.
//
// The file must be a regular file that only its owner can access (mode 0600
// or stricter); anything looser is refused, because the key lets whoever
// holds it impersonate the installation at Apple. The key content never
// appears in an error message.
func ReadPrivateKeyFile(path string) ([]byte, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("security: private key file: %w", err)
	}
	if !info.Mode().IsRegular() {
		return nil, fmt.Errorf("security: private key file %s is not a regular file", path)
	}
	if perm := info.Mode().Perm(); perm&0o077 != 0 {
		return nil, fmt.Errorf("security: private key file %s has mode %04o; it must be readable by its owner only: "+
			"run chmod 600 %s", path, perm, path)
	}
	if info.Size() > maxPrivateKeyBytes {
		return nil, fmt.Errorf("security: private key file %s is larger than %d bytes", path, maxPrivateKeyBytes)
	}
	content, err := os.ReadFile(path) //nolint:gosec // G304: the operator names the key file on purpose
	if err != nil {
		return nil, fmt.Errorf("security: read private key file: %w", err)
	}
	if err := checkECPrivateKey(content); err != nil {
		return nil, fmt.Errorf("security: private key file %s: %w", path, err)
	}
	return content, nil
}

// checkECPrivateKey accepts exactly one PEM "PRIVATE KEY" block holding a
// PKCS #8 EC key, the format Apple issues and Zitadel parses.
func checkECPrivateKey(content []byte) error {
	block, _ := pem.Decode(content)
	if block == nil || block.Type != "PRIVATE KEY" {
		return errors.New("no PEM \"PRIVATE KEY\" block found (expected Apple's .p8 file)")
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return errors.New("the PEM block is not a valid PKCS #8 private key")
	}
	if _, ok := key.(*ecdsa.PrivateKey); !ok {
		return errors.New("the key is not an EC key (Apple issues P-256 keys)")
	}
	return nil
}
