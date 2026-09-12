package security

import (
	"bytes"
	"errors"
	"strings"
	"testing"
)

// failingReader yields entropy for the first n reads and then fails, so each
// error branch of the generator can be reached deterministically.
type failingReader struct {
	remaining int
}

func (f *failingReader) Read(p []byte) (int, error) {
	if f.remaining <= 0 {
		return 0, errors.New("entropy source exhausted")
	}
	f.remaining--
	for i := range p {
		p[i] = 0x41
	}
	return len(p), nil
}

func TestHex(t *testing.T) {
	g := NewGeneratorWithSource(bytes.NewReader(bytes.Repeat([]byte{0xAB}, 16)))
	got, err := g.Hex(16)
	if err != nil {
		t.Fatalf("Hex() error = %v", err)
	}
	if len(got) != 32 {
		t.Fatalf("Hex(16) length = %d, want 32", len(got))
	}
	if got != strings.Repeat("ab", 16) {
		t.Fatalf("Hex(16) = %q", got)
	}
}

func TestHexMasterkeyIsExactly32Chars(t *testing.T) {
	// Zitadel rejects a masterkey that is not exactly 32 characters.
	g := NewGenerator()
	for i := 0; i < 32; i++ {
		got, err := g.Hex(16)
		if err != nil {
			t.Fatalf("Hex() error = %v", err)
		}
		if len(got) != 32 {
			t.Fatalf("masterkey length = %d, want exactly 32", len(got))
		}
	}
}

func TestBase64(t *testing.T) {
	g := NewGeneratorWithSource(bytes.NewReader(make([]byte, 32)))
	got, err := g.Base64(32)
	if err != nil {
		t.Fatalf("Base64() error = %v", err)
	}
	if got != "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" {
		t.Fatalf("Base64(32) = %q", got)
	}
}

func TestAlphanumeric(t *testing.T) {
	g := NewGenerator()
	got, err := g.Alphanumeric(32)
	if err != nil {
		t.Fatalf("Alphanumeric() error = %v", err)
	}
	if len(got) != 32 {
		t.Fatalf("length = %d, want 32", len(got))
	}
	for _, r := range got {
		if !strings.ContainsRune(alphanumeric, r) {
			t.Fatalf("character %q is outside the alphabet", r)
		}
	}
}

func TestAlphanumericDistributionIsNotDegenerate(t *testing.T) {
	// A modulo-biased or broken implementation collapses onto a small set of
	// characters; a healthy one covers most of the 62 character alphabet.
	g := NewGenerator()
	seen := map[rune]bool{}
	for i := 0; i < 200; i++ {
		s, err := g.Alphanumeric(32)
		if err != nil {
			t.Fatal(err)
		}
		for _, r := range s {
			seen[r] = true
		}
	}
	if len(seen) < 55 {
		t.Fatalf("only %d of %d alphabet characters observed", len(seen), len(alphanumeric))
	}
}

func TestComplexSatisfiesPolicy(t *testing.T) {
	g := NewGenerator()
	for i := 0; i < 100; i++ {
		got, err := g.Complex(24)
		if err != nil {
			t.Fatalf("Complex() error = %v", err)
		}
		if len(got) != 24 {
			t.Fatalf("length = %d, want 24", len(got))
		}
		if !strings.ContainsAny(got, lowerSet) {
			t.Fatalf("%q has no lowercase character", got)
		}
		if !strings.ContainsAny(got, upperSet) {
			t.Fatalf("%q has no uppercase character", got)
		}
		if !strings.ContainsAny(got, digitSet) {
			t.Fatalf("%q has no digit", got)
		}
		if !strings.ContainsAny(got, symbolSet) {
			t.Fatalf("%q has no symbol", got)
		}
		// Characters that break dotenv parsing or shell quoting must never
		// appear in a generated password.
		if strings.ContainsAny(got, "$`\"'\\ \t\n") {
			t.Fatalf("%q contains a shell-hostile character", got)
		}
	}
}

func TestComplexIsNotPositional(t *testing.T) {
	// Without the shuffle the first four characters would always be
	// lower, upper, digit, symbol in that order.
	g := NewGenerator()
	firstAlwaysLower := true
	for i := 0; i < 50; i++ {
		got, err := g.Complex(16)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.ContainsAny(string(got[0]), lowerSet) {
			firstAlwaysLower = false
			break
		}
	}
	if firstAlwaysLower {
		t.Fatal("the required character classes appear to be positional")
	}
}

func TestComplexTooShort(t *testing.T) {
	g := NewGenerator()
	if _, err := g.Complex(3); err == nil {
		t.Fatal("Complex(3) error = nil, want a failure")
	}
}

func TestNonPositiveLengths(t *testing.T) {
	g := NewGenerator()
	if _, err := g.Hex(0); err == nil {
		t.Fatal("Hex(0) error = nil")
	}
	if _, err := g.Base64(-1); err == nil {
		t.Fatal("Base64(-1) error = nil")
	}
	if _, err := g.Alphanumeric(0); err == nil {
		t.Fatal("Alphanumeric(0) error = nil")
	}
}

func TestEntropyFailuresPropagate(t *testing.T) {
	tests := []struct {
		name      string
		remaining int
		call      func(Generator) error
	}{
		{"hex", 0, func(g Generator) error { _, err := g.Hex(16); return err }},
		{"base64", 0, func(g Generator) error { _, err := g.Base64(32); return err }},
		{"alphanumeric", 0, func(g Generator) error { _, err := g.Alphanumeric(8); return err }},
		{"complex first class", 0, func(g Generator) error { _, err := g.Complex(8); return err }},
		{"complex filler", 4, func(g Generator) error { _, err := g.Complex(24); return err }},
		// Complex(24) draws 24 characters and then performs 23 shuffle reads
		// against this constant source, so a budget of 30 is exhausted part
		// way through the shuffle.
		{"complex shuffle", 30, func(g Generator) error { _, err := g.Complex(24); return err }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			g := NewGeneratorWithSource(&failingReader{remaining: tc.remaining})
			if err := tc.call(g); err == nil {
				t.Fatal("error = nil, want the entropy failure to surface")
			}
		})
	}
}

func TestNewGeneratorUsesCryptoRand(t *testing.T) {
	a, err := NewGenerator().Hex(16)
	if err != nil {
		t.Fatal(err)
	}
	b, err := NewGenerator().Hex(16)
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("two generators produced identical output")
	}
}
