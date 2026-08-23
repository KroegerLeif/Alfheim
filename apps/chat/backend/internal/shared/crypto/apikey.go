// Package crypto provides AES-256-GCM helpers for encrypting model block API keys at rest.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

// KeySize is the required length in bytes for an AES-256 key.
const KeySize = 32

// ErrInvalidKeySize is returned when a decoded key does not have the expected AES-256 length.
var ErrInvalidKeySize = errors.New("encryption key must be exactly 32 bytes for AES-256")

// DecodeKey decodes a standard base64-encoded AES-256 key, validating its length.
func DecodeKey(base64Key string) ([]byte, error) {
	key, err := base64.StdEncoding.DecodeString(base64Key)
	if err != nil {
		return nil, fmt.Errorf("failed to base64-decode encryption key: %w", err)
	}
	if len(key) != KeySize {
		return nil, ErrInvalidKeySize
	}
	return key, nil
}

// Encrypt seals plaintext (e.g. a provider API key) using AES-256-GCM.
// The returned ciphertext is prefixed with the randomly generated nonce.
func Encrypt(key []byte, plaintext string) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to construct aes cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to construct gcm mode: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate random nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return ciphertext, nil
}

// Decrypt opens ciphertext previously produced by Encrypt.
func Decrypt(key []byte, ciphertext []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to construct aes cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to construct gcm mode: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext shorter than nonce size")
	}

	nonce, sealed := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, sealed, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt ciphertext: %w", err)
	}

	return string(plaintext), nil
}
