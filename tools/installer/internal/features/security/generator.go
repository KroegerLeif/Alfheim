// Package security generates the cryptographic material an Alfheim
// installation needs. Every value originates from crypto/rand.
package security

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"math/big"
)

const (
	alphanumeric = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	lowerSet     = "abcdefghijklmnopqrstuvwxyz"
	upperSet     = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	digitSet     = "0123456789"
	// symbolSet deliberately excludes characters that are hostile inside a
	// dotenv value or a shell: $ ` " ' \ and whitespace.
	symbolSet = "!#%&*+-.:=?@^_~"
)

// Generator produces random secrets.
type Generator interface {
	// Hex returns the hex encoding of nBytes random bytes, so the result is
	// 2*nBytes characters long.
	Hex(nBytes int) (string, error)
	// Base64 returns the standard base64 encoding of nBytes random bytes.
	Base64(nBytes int) (string, error)
	// Alphanumeric returns n characters drawn uniformly from [A-Za-z0-9].
	Alphanumeric(n int) (string, error)
	// Complex returns n characters guaranteed to include at least one
	// lowercase letter, uppercase letter, digit and symbol.
	Complex(n int) (string, error)
}

// CryptoGenerator is the crypto/rand backed Generator. The entropy source is
// injectable so tests can assert exact output and exercise failure paths.
type CryptoGenerator struct {
	rand io.Reader
}

// NewGenerator returns a Generator reading from crypto/rand.
func NewGenerator() *CryptoGenerator {
	return &CryptoGenerator{rand: rand.Reader}
}

// NewGeneratorWithSource returns a Generator reading from src. It exists for
// deterministic tests and must not be used in production code.
func NewGeneratorWithSource(src io.Reader) *CryptoGenerator {
	return &CryptoGenerator{rand: src}
}

// Hex returns 2*nBytes hex characters.
func (g *CryptoGenerator) Hex(nBytes int) (string, error) {
	buf, err := g.read(nBytes)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// Base64 returns the standard base64 encoding of nBytes random bytes.
func (g *CryptoGenerator) Base64(nBytes int) (string, error) {
	buf, err := g.read(nBytes)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(buf), nil
}

// Alphanumeric returns n uniformly distributed alphanumeric characters.
func (g *CryptoGenerator) Alphanumeric(n int) (string, error) {
	return g.fromAlphabet(n, alphanumeric)
}

// Complex returns an n character password satisfying the Zitadel default
// complexity policy. One character from each required class is placed first
// and the whole result is then shuffled, so the classes are not positional.
func (g *CryptoGenerator) Complex(n int) (string, error) {
	classes := []string{lowerSet, upperSet, digitSet, symbolSet}
	if n < len(classes) {
		return "", fmt.Errorf("security: complex password needs at least %d characters, got %d",
			len(classes), n)
	}

	out := make([]byte, 0, n)
	for _, class := range classes {
		c, err := g.pick(class)
		if err != nil {
			return "", err
		}
		out = append(out, c)
	}

	all := lowerSet + upperSet + digitSet + symbolSet
	for len(out) < n {
		c, err := g.pick(all)
		if err != nil {
			return "", err
		}
		out = append(out, c)
	}

	if err := g.shuffle(out); err != nil {
		return "", err
	}
	return string(out), nil
}

// fromAlphabet draws n characters uniformly from the alphabet.
func (g *CryptoGenerator) fromAlphabet(n int, alphabet string) (string, error) {
	if n <= 0 {
		return "", fmt.Errorf("security: length must be positive, got %d", n)
	}
	out := make([]byte, n)
	for i := range out {
		c, err := g.pick(alphabet)
		if err != nil {
			return "", err
		}
		out[i] = c
	}
	return string(out), nil
}

// pick draws a single uniformly distributed character. rand.Int performs
// rejection sampling internally, which avoids the modulo bias of a naive
// "randomByte % len(alphabet)".
func (g *CryptoGenerator) pick(alphabet string) (byte, error) {
	idx, err := rand.Int(g.rand, big.NewInt(int64(len(alphabet))))
	if err != nil {
		return 0, fmt.Errorf("security: read entropy: %w", err)
	}
	return alphabet[idx.Int64()], nil
}

// shuffle performs an in-place Fisher-Yates shuffle using crypto entropy.
func (g *CryptoGenerator) shuffle(buf []byte) error {
	for i := len(buf) - 1; i > 0; i-- {
		j, err := rand.Int(g.rand, big.NewInt(int64(i+1)))
		if err != nil {
			return fmt.Errorf("security: read entropy: %w", err)
		}
		buf[i], buf[j.Int64()] = buf[j.Int64()], buf[i]
	}
	return nil
}

// read returns nBytes of entropy.
func (g *CryptoGenerator) read(nBytes int) ([]byte, error) {
	if nBytes <= 0 {
		return nil, fmt.Errorf("security: byte count must be positive, got %d", nBytes)
	}
	buf := make([]byte, nBytes)
	if _, err := io.ReadFull(g.rand, buf); err != nil {
		return nil, fmt.Errorf("security: read entropy: %w", err)
	}
	return buf, nil
}
