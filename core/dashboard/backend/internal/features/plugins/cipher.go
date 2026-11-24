package plugins

import (
	"encoding/json"
	"fmt"

	"alfheim/go-shared/crypto"
)

// Cipher encrypts plugin credentials with the configured AES-256-GCM key
// (INTEGRATIONS_ENCRYPTION_KEY) and records the key id
// (INTEGRATIONS_ENCRYPTION_KEY_ID) that sealed each row, so a key can be
// rotated later by re-encrypting rows. The encryption itself is go-shared's.
type Cipher struct {
	key   []byte
	keyID string
}

// NewCipher returns a cipher for key and keyID. An empty key yields a cipher
// that refuses every operation with ErrEncryptionUnavailable: credentials are
// then neither stored nor read, while the rest of the dashboard keeps working.
func NewCipher(key []byte, keyID string) (*Cipher, error) {
	if len(key) == 0 {
		return &Cipher{}, nil
	}
	if len(key) != crypto.KeySize {
		return nil, crypto.ErrInvalidKeySize
	}
	if keyID == "" {
		return nil, fmt.Errorf("an encryption key id is required")
	}
	return &Cipher{key: append([]byte(nil), key...), keyID: keyID}, nil
}

// Available reports whether a key is configured.
func (c *Cipher) Available() bool {
	return len(c.key) > 0
}

// Seal encrypts creds and returns the ciphertext with the id of the key used.
func (c *Cipher) Seal(creds Credentials) ([]byte, string, error) {
	if !c.Available() {
		return nil, "", ErrEncryptionUnavailable
	}
	plain, err := json.Marshal(creds)
	if err != nil {
		return nil, "", fmt.Errorf("encode credentials: %w", err)
	}
	sealed, err := crypto.Encrypt(c.key, string(plain))
	if err != nil {
		return nil, "", fmt.Errorf("encrypt credentials: %w", err)
	}
	return sealed, c.keyID, nil
}

// Open decrypts ciphertext that the key keyID sealed. Empty ciphertext yields
// empty credentials without needing a key.
func (c *Cipher) Open(ciphertext []byte, keyID string) (Credentials, error) {
	if len(ciphertext) == 0 {
		return Credentials{}, nil
	}
	if !c.Available() {
		return nil, ErrEncryptionUnavailable
	}
	if keyID != c.keyID {
		return nil, fmt.Errorf("%w: row key %q, configured key %q", ErrKeyMismatch, keyID, c.keyID)
	}
	plain, err := crypto.Decrypt(c.key, ciphertext)
	if err != nil {
		return nil, fmt.Errorf("decrypt credentials: %w", err)
	}
	creds := Credentials{}
	if err := json.Unmarshal([]byte(plain), &creds); err != nil {
		return nil, fmt.Errorf("decode credentials: %w", err)
	}
	return creds, nil
}
