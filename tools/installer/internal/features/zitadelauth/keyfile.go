// Package zitadelauth obtains the credential alfheim-setup authenticates to
// Zitadel's APIs with, without keeping a never-expiring token around.
//
// Zitadel hands the first instance's machine user a personal access token
// (PAT) exactly once, on first init. alfheim-setup uses that PAT only to
// register a machine key for the same user, then revokes every PAT the user
// holds. From then on each run signs a JWT with the stored key, exchanges it
// at Zitadel's token endpoint (JWT profile grant, RFC 7523) for an access
// token that lives for hours, and rotates the key: a new key with a fresh
// expiry replaces the old one, which is deleted in Zitadel. A stolen copy of
// an older key is therefore worthless after the next run, and an untouched
// key expires on its own after KeyLifetime.
package zitadelauth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// Key is a Zitadel machine key in the JSON format Zitadel returns when the
// key is created ("serviceaccount" type).
type Key struct {
	Type   string `json:"type"`
	KeyID  string `json:"keyId"`
	Key    string `json:"key"`
	UserID string `json:"userId"`

	private *rsa.PrivateKey
}

// ParseKey decodes a machine key file's JSON and its PEM-encoded RSA
// private key.
func ParseKey(data []byte) (Key, error) {
	var k Key
	if err := json.Unmarshal(data, &k); err != nil {
		return Key{}, fmt.Errorf("zitadelauth: decode machine key: %w", err)
	}
	if k.KeyID == "" || k.UserID == "" || k.Key == "" {
		return Key{}, errors.New("zitadelauth: machine key lacks keyId, userId or key")
	}
	block, _ := pem.Decode([]byte(k.Key))
	if block == nil {
		return Key{}, errors.New("zitadelauth: machine key holds no PEM private key")
	}
	private, err := parseRSAPrivateKey(block.Bytes)
	if err != nil {
		return Key{}, err
	}
	k.private = private
	return k, nil
}

// parseRSAPrivateKey accepts PKCS#1, which Zitadel writes, and PKCS#8.
func parseRSAPrivateKey(der []byte) (*rsa.PrivateKey, error) {
	if key, err := x509.ParsePKCS1PrivateKey(der); err == nil {
		return key, nil
	}
	parsed, err := x509.ParsePKCS8PrivateKey(der)
	if err != nil {
		return nil, fmt.Errorf("zitadelauth: parse machine key: %w", err)
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("zitadelauth: machine key is not an RSA key")
	}
	return key, nil
}

// LoadKey reads the stored machine key. found is false, with a nil error,
// when no key has been stored yet. A key readable by group or others is
// refused: it is an IAM-owner credential and must stay owner-only.
func LoadKey(path string) (key Key, found bool, err error) {
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return Key{}, false, nil
	}
	if err != nil {
		return Key{}, false, fmt.Errorf("zitadelauth: stat %s: %w", path, err)
	}
	if info.Mode().Perm()&0o077 != 0 {
		return Key{}, false, fmt.Errorf(
			"zitadelauth: %s has mode %04o; the Zitadel machine key must be owner-only, run: chmod 600 %s",
			path, info.Mode().Perm(), path)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return Key{}, false, fmt.Errorf("zitadelauth: read %s: %w", path, err)
	}
	key, err = ParseKey(data)
	if err != nil {
		return Key{}, false, fmt.Errorf("%w (in %s)", err, path)
	}
	return key, true, nil
}

// WriteKey stores a machine key's JSON at path with mode 0600, in a 0700
// directory. It writes a temporary file and renames it, so a crash never
// leaves a truncated key behind and the previous key stays usable until the
// new one is complete.
func WriteKey(path string, data []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("zitadelauth: create %s: %w", dir, err)
	}
	tmp, err := os.CreateTemp(dir, ".key-*.json")
	if err != nil {
		return fmt.Errorf("zitadelauth: create temporary key file in %s: %w", dir, err)
	}
	tmpName := tmp.Name()
	// CreateTemp already creates the file 0600; the explicit chmod keeps the
	// owner-only requirement visible here instead of relying on that detail.
	_, writeErr := tmp.Write(data)
	err = errors.Join(tmp.Chmod(0o600), writeErr, tmp.Sync(), tmp.Close())
	if err == nil {
		err = os.Rename(tmpName, path)
	}
	if err != nil {
		return errors.Join(fmt.Errorf("zitadelauth: write %s: %w", path, err), RemoveIfExists(tmpName))
	}
	return nil
}

// RemoveIfExists deletes path and treats an already missing file as success.
func RemoveIfExists(path string) error {
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}
