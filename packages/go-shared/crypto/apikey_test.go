package crypto

import (
	"crypto/cipher"
	"encoding/base64"
	"errors"
	"testing"
)

func testKey(t *testing.T) []byte {
	t.Helper()
	key := make([]byte, KeySize)
	for i := range key {
		key[i] = byte(i)
	}
	return key
}

func TestDecodeKey(t *testing.T) {
	t.Run("accepts a valid 32-byte base64 key", func(t *testing.T) {
		encoded := base64.StdEncoding.EncodeToString(testKey(t))
		key, err := DecodeKey(encoded)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(key) != KeySize {
			t.Errorf("expected key length %d, got %d", KeySize, len(key))
		}
	})

	t.Run("rejects invalid base64", func(t *testing.T) {
		if _, err := DecodeKey("not-base64!!!"); err == nil {
			t.Errorf("expected error for invalid base64 input")
		}
	})

	t.Run("rejects a key of the wrong length", func(t *testing.T) {
		encoded := base64.StdEncoding.EncodeToString([]byte("too-short"))
		if _, err := DecodeKey(encoded); err != ErrInvalidKeySize {
			t.Errorf("expected ErrInvalidKeySize, got %v", err)
		}
	})
}

func TestEncryptDecrypt(t *testing.T) {
	key := testKey(t)

	t.Run("round-trips plaintext", func(t *testing.T) {
		plaintext := "sk-test-provider-api-key"
		ciphertext, err := Encrypt(key, plaintext)
		if err != nil {
			t.Fatalf("unexpected encrypt error: %v", err)
		}

		decrypted, err := Decrypt(key, ciphertext)
		if err != nil {
			t.Fatalf("unexpected decrypt error: %v", err)
		}
		if decrypted != plaintext {
			t.Errorf("expected decrypted plaintext %q, got %q", plaintext, decrypted)
		}
	})

	t.Run("produces different ciphertext on each call due to random nonce", func(t *testing.T) {
		a, err := Encrypt(key, "same-input")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		b, err := Encrypt(key, "same-input")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if string(a) == string(b) {
			t.Errorf("expected distinct ciphertexts for repeated encryption of the same plaintext")
		}
	})

	t.Run("fails to decrypt with the wrong key", func(t *testing.T) {
		ciphertext, err := Encrypt(key, "secret")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		wrongKey := make([]byte, KeySize)
		copy(wrongKey, key)
		wrongKey[0] ^= 0xFF

		if _, err := Decrypt(wrongKey, ciphertext); err == nil {
			t.Errorf("expected error decrypting with wrong key")
		}
	})

	t.Run("fails to decrypt truncated ciphertext", func(t *testing.T) {
		if _, err := Decrypt(key, []byte("short")); err == nil {
			t.Errorf("expected error decrypting undersized ciphertext")
		}
	})

	t.Run("fails to encrypt with invalid key size", func(t *testing.T) {
		if _, err := Encrypt([]byte("too-short"), "data"); err == nil {
			t.Errorf("expected error encrypting with invalid key length")
		}
	})

	t.Run("fails to decrypt with invalid key size", func(t *testing.T) {
		if _, err := Decrypt([]byte("too-short"), []byte("somedata")); err == nil {
			t.Errorf("expected error decrypting with invalid key length")
		}
	})

	t.Run("fails when randReader returns error", func(t *testing.T) {
		orig := randReader
		defer func() { randReader = orig }()

		randReader = &errReader{}
		if _, err := Encrypt(key, "data"); err == nil {
			t.Errorf("expected error when randReader fails")
		}
	})

	t.Run("fails when newGCM returns error on Encrypt and Decrypt", func(t *testing.T) {
		orig := newGCM
		defer func() { newGCM = orig }()

		newGCM = func(cipher.Block) (cipher.AEAD, error) {
			return nil, errors.New("simulated gcm construction error")
		}

		if _, err := Encrypt(key, "data"); err == nil {
			t.Errorf("expected error from Encrypt when newGCM fails")
		}
		if _, err := Decrypt(key, []byte("somelongerciphertext")); err == nil {
			t.Errorf("expected error from Decrypt when newGCM fails")
		}
	})
}

type errReader struct{}

func (e *errReader) Read(p []byte) (n int, err error) {
	return 0, errors.New("entropy source depleted")
}
