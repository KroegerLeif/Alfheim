package envfile

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParse(t *testing.T) {
	input := `
# A comment line
POSTGRES_USER=postgres

  ZITADEL_MASTERKEY=abc123
export EXPORTED_KEY=value
QUOTED_DOUBLE="has spaces"
QUOTED_SINGLE='single'
EMPTY=
WITH_EQUALS=a=b=c
MALFORMED_LINE_WITHOUT_SEPARATOR
=novalue
SHORT="
`
	got, err := Parse(strings.NewReader(input))
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}

	want := map[string]string{
		"POSTGRES_USER":     "postgres",
		"ZITADEL_MASTERKEY": "abc123",
		"EXPORTED_KEY":      "value",
		"QUOTED_DOUBLE":     "has spaces",
		"QUOTED_SINGLE":     "single",
		"EMPTY":             "",
		"WITH_EQUALS":       "a=b=c",
		"SHORT":             `"`,
	}
	if len(got) != len(want) {
		t.Fatalf("Parse() returned %d keys (%v), want %d", len(got), got, len(want))
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("key %s = %q, want %q", k, got[k], v)
		}
	}
	if _, ok := got["MALFORMED_LINE_WITHOUT_SEPARATOR"]; ok {
		t.Error("a line without a separator must be skipped")
	}
	if _, ok := got[""]; ok {
		t.Error("an empty key must be skipped")
	}
}

func TestParseFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	if err := os.WriteFile(path, []byte("KEY=value\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	got, err := ParseFile(path)
	if err != nil {
		t.Fatalf("ParseFile() error = %v", err)
	}
	if got["KEY"] != "value" {
		t.Fatalf("KEY = %q, want %q", got["KEY"], "value")
	}

	if _, err := ParseFile(filepath.Join(dir, "missing")); err == nil {
		t.Fatal("ParseFile() error = nil for a missing file")
	}
}

func TestParseLongValue(t *testing.T) {
	long := strings.Repeat("x", 200*1024)
	got, err := Parse(strings.NewReader("BIG=" + long + "\n"))
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if got["BIG"] != long {
		t.Fatalf("long value was truncated to %d bytes", len(got["BIG"]))
	}
}

type failingReader struct{}

func (failingReader) Read([]byte) (int, error) { return 0, os.ErrClosed }

func TestParseReadError(t *testing.T) {
	if _, err := Parse(failingReader{}); err == nil {
		t.Fatal("Parse() error = nil, want the read failure to surface")
	}
}
