// Package assets is the single source of truth, on the Go side, for which
// standalone stack files a release publishes and where each one lives under
// an installation root. `alfheim-setup update` fetches and verifies exactly
// this list.
//
// install.sh cannot import this package (it is a POSIX shell bootstrapper
// that runs before any Go binary exists on the host), so it keeps its own
// fetch_stack_asset calls in step 4b. .github/workflows/release.yml's
// "Stage Standalone Install Assets" / "Generate Checksums" steps also list
// these names by hand, to decide what a release publishes in the first
// place. All three lists must name the same release assets. If you add,
// rename or remove one here, update install.sh and release.yml to match.
package assets

import "os"

// Asset describes one file a release publishes standalone (outside the
// container images), verified against that release's SHA256SUMS.
type Asset struct {
	// Name is the release asset's filename, exactly as SHA256SUMS lists it.
	// Release assets are flattened to their basename, which is why this can
	// differ from Dest (for example "otelcol-config.yaml" ships at
	// infrastructure/telemetry/collector/config.yaml).
	Name string
	// Dest is the destination path relative to the installation root.
	Dest string
	// Mode is the file permission applied after writing Dest.
	Mode os.FileMode
}

// StackAssets are the static configuration files compose.prod.yaml
// bind-mounts, plus the verification script. A fresh install fetches these
// once (install.sh, when no local checkout exists); `alfheim-setup update`
// re-fetches the target release's copies, backs up the previous files and
// replaces them. None of these ever hold a secret, so they need no special
// handling beyond a checksum check.
var StackAssets = []Asset{
	{Name: "compose.prod.yaml", Dest: "compose.prod.yaml", Mode: 0o644},
	{Name: "otelcol-config.yaml", Dest: "infrastructure/telemetry/collector/config.yaml", Mode: 0o644},
	{Name: "init-multiple-dbs.sh", Dest: "infrastructure/postgres/init-multiple-dbs.sh", Mode: 0o755},
	{Name: "vector.toml", Dest: "infrastructure/telemetry/vector/vector.toml", Mode: 0o644},
	{Name: "verify-stack.sh", Dest: "scripts/verify-stack.sh", Mode: 0o755},
}

// BinaryAssetName renders the release asset name for the alfheim-setup
// binary built for a given GOARCH, matching install.sh's ASSET variable and
// release.yml's `-o "alfheim-setup_linux_${{ matrix.goarch }}"` build step.
func BinaryAssetName(arch string) string {
	return "alfheim-setup_linux_" + arch
}

// SHA256SUMSName is the checksum manifest every release publishes, listing
// the digest of the binary assets and every entry in StackAssets.
const SHA256SUMSName = "SHA256SUMS"
