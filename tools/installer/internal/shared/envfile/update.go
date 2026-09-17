package envfile

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Update idempotently writes kv into the dotenv file at path: an existing
// KEY=... line is replaced in place, and a key absent from the file is
// appended. Values are written literally (no quoting), matching how
// scripts/zitadel-bootstrap.sh's set_env behaved, since the values Update is
// used for — ids and generated secrets — never contain a newline and any
// quoting would only be undone by envfile.Parse's own unquoting on the next
// read.
//
// The file is rewritten atomically (write to a temp file, then rename over
// the original) and its mode is preserved, since a production .env holds
// every credential in the stack and defaults to 0600.
func Update(path string, kv map[string]string) error {
	if len(kv) == 0 {
		return nil
	}

	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("envfile: stat %s: %w", path, err)
	}
	mode := info.Mode().Perm()

	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("envfile: open %s: %w", path, err)
	}
	defer func() { _ = f.Close() }()

	remaining := make(map[string]string, len(kv))
	for k, v := range kv {
		remaining[k] = v
	}

	var lines []string
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		key, _, found := strings.Cut(strings.TrimPrefix(strings.TrimSpace(line), "export "), "=")
		key = strings.TrimSpace(key)
		if found {
			if value, ok := remaining[key]; ok {
				lines = append(lines, key+"="+value)
				delete(remaining, key)
				continue
			}
		}
		lines = append(lines, line)
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("envfile: read %s: %w", path, err)
	}
	_ = f.Close()

	if len(remaining) > 0 {
		// Deterministic order keeps repeated runs producing an identical
		// diff instead of shuffling appended keys around.
		keys := make([]string, 0, len(remaining))
		for k := range remaining {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			lines = append(lines, k+"="+remaining[k])
		}
	}

	content := strings.Join(lines, "\n")
	if len(lines) > 0 {
		content += "\n"
	}

	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".envfile-update-*")
	if err != nil {
		return fmt.Errorf("envfile: create temp file next to %s: %w", path, err)
	}
	tmpPath := tmp.Name()
	defer func() { _ = os.Remove(tmpPath) }()

	if _, err := tmp.WriteString(content); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("envfile: write %s: %w", tmpPath, err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("envfile: close %s: %w", tmpPath, err)
	}
	if err := os.Chmod(tmpPath, mode); err != nil {
		return fmt.Errorf("envfile: set permissions on %s: %w", tmpPath, err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return fmt.Errorf("envfile: replace %s: %w", path, err)
	}
	return nil
}
