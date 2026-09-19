// Package updater implements the download, checksum verification and
// backup/replace steps behind `alfheim-setup update`: fetching a target
// release's standalone stack assets (see internal/shared/assets), verifying
// them against that release's SHA256SUMS exactly as install.sh does, backing
// up whatever was on disk before overwriting it, and reporting where that
// backup landed so a failed update can be rolled back by hand.
package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"alfheim/installer/internal/shared/assets"
)

// Getter fetches the content at url. Production code uses Fetcher; tests
// inject a fake or point Fetcher at an httptest.Server.
type Getter func(ctx context.Context, url string) ([]byte, error)

// Fetcher is the real Getter, downloading over HTTP.
type Fetcher struct {
	// Client performs the request. Defaults to http.DefaultClient.
	Client *http.Client
}

// Get implements Getter.
func (f Fetcher) Get(ctx context.Context, url string) ([]byte, error) {
	client := f.Client
	if client == nil {
		client = http.DefaultClient
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("updater: build request for %s: %w", url, err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("updater: fetch %s: %w", url, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("updater: fetch %s: unexpected status %s", url, resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("updater: read %s: %w", url, err)
	}
	return body, nil
}

// ParseChecksums parses a SHA256SUMS file (as produced by `sha256sum`) into
// a map of release asset name to lowercase hex digest.
func ParseChecksums(content []byte) map[string]string {
	out := map[string]string{}
	for _, line := range strings.Split(string(content), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		// sha256sum marks binary mode with a leading "*" on the filename.
		name := strings.TrimPrefix(fields[len(fields)-1], "*")
		out[name] = strings.ToLower(fields[0])
	}
	return out
}

// Verify reports whether content's SHA-256 digest matches the one sums lists
// for name, refusing to proceed when the name is missing entirely (an
// unverifiable file) rather than treating that as a pass.
func Verify(name string, content []byte, sums map[string]string) error {
	expected, ok := sums[name]
	if !ok {
		return fmt.Errorf("updater: SHA256SUMS does not list %s; refusing to use an unverified file", name)
	}
	sum := sha256.Sum256(content)
	actual := hex.EncodeToString(sum[:])
	if !strings.EqualFold(expected, actual) {
		return fmt.Errorf("updater: checksum mismatch for %s: expected %s, got %s", name, expected, actual)
	}
	return nil
}

// FetchAssets downloads SHA256SUMS and every asset in list from baseURL
// (each at baseURL+"/"+asset.Name, matching a GitHub release's flat asset
// layout), verifies each against the checksum file, and returns the
// verified content keyed by the asset's Dest path.
func FetchAssets(ctx context.Context, get Getter, baseURL string, list []assets.Asset) (map[string][]byte, error) {
	sumsRaw, err := get(ctx, baseURL+"/"+assets.SHA256SUMSName)
	if err != nil {
		return nil, fmt.Errorf("updater: download %s: %w", assets.SHA256SUMSName, err)
	}
	sums := ParseChecksums(sumsRaw)

	out := make(map[string][]byte, len(list))
	for _, a := range list {
		content, err := get(ctx, baseURL+"/"+a.Name)
		if err != nil {
			return nil, fmt.Errorf("updater: download %s: %w", a.Name, err)
		}
		if err := Verify(a.Name, content, sums); err != nil {
			return nil, err
		}
		out[a.Dest] = content
	}
	return out, nil
}

// Backup copies every asset destination that currently exists under root
// into a fresh timestamped directory (root/.alfheim-backups/<UTC
// timestamp>/<dest>), mirroring the original relative paths so a rollback is
// a straight copy back. Assets absent on disk (a fresh addition to the
// asset list) are simply skipped. It returns the backup directory, which is
// created even when nothing existed yet to back up, so callers always have
// a concrete path to report.
func Backup(root string, list []assets.Asset, now time.Time) (string, error) {
	dir := filepath.Join(root, ".alfheim-backups", now.UTC().Format("20060102T150405Z"))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("updater: create backup directory %s: %w", dir, err)
	}
	for _, a := range list {
		src := filepath.Join(root, a.Dest)
		info, err := os.Stat(src)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return "", fmt.Errorf("updater: stat %s: %w", src, err)
		}
		if info.IsDir() {
			continue
		}
		content, err := os.ReadFile(src)
		if err != nil {
			return "", fmt.Errorf("updater: read %s: %w", src, err)
		}
		dest := filepath.Join(dir, a.Dest)
		if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
			return "", fmt.Errorf("updater: create %s: %w", filepath.Dir(dest), err)
		}
		if err := os.WriteFile(dest, content, info.Mode().Perm()); err != nil {
			return "", fmt.Errorf("updater: write backup %s: %w", dest, err)
		}
	}
	return dir, nil
}

// Replace writes verified asset content (as returned by FetchAssets) to its
// destination under root, creating parent directories as needed and
// applying each asset's declared file mode. Call Backup first: this
// overwrites whatever is on disk unconditionally.
func Replace(root string, list []assets.Asset, content map[string][]byte) error {
	for _, a := range list {
		data, ok := content[a.Dest]
		if !ok {
			return fmt.Errorf("updater: no downloaded content for %s", a.Dest)
		}
		dest := filepath.Join(root, a.Dest)
		if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
			return fmt.Errorf("updater: create %s: %w", filepath.Dir(dest), err)
		}
		if err := os.WriteFile(dest, data, a.Mode); err != nil {
			return fmt.Errorf("updater: write %s: %w", dest, err)
		}
	}
	return nil
}
