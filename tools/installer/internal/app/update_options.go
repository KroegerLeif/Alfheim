package app

import (
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
)

// updateUsage documents the `update` subcommand.
const updateUsage = `alfheim-setup update - fetch a new release and restart an existing installation

Usage:
  alfheim-setup update [--version vX.Y.Z] [--install-dir DIR] [--yes]

Requires an existing installation (a completed alfheim-setup run) at
--install-dir; it never runs the configuration wizard, never rotates a
secret, and never touches the root CA, the Zitadel machinekey or any Docker
volume.

Flags:
  --version TAG        ALFHEIM_VERSION       Release to update to, e.g. v1.4.0.
                                             Defaults to this binary's own
                                             build version; never "latest".
  --install-dir DIR    ALFHEIM_INSTALL_DIR   Installation root (default: the
                                             current directory).
  --repo OWNER/REPO    ALFHEIM_REPO          Release repository to fetch
                                             assets from (default:
                                             KroegerLeif/Alfheim).
  --yes                                      Skip the confirmation prompt.

Exit codes:
  0 success   1 failure   2 usage error
`

// defaultUpdateRepo is the release repository install.sh also defaults to
// (ALFHEIM_REPO there).
const defaultUpdateRepo = "KroegerLeif/Alfheim"

// UpdateOptions are the parsed `update` subcommand flags.
type UpdateOptions struct {
	Version    string
	InstallDir string
	Repo       string
	Yes        bool
}

// ParseUpdateOptions parses the `update` subcommand's arguments, falling
// back to the environment exactly like ParseOptions does for the top-level
// command.
func ParseUpdateOptions(args []string, stderr io.Writer) (*UpdateOptions, error) {
	opts := &UpdateOptions{}

	fs := flag.NewFlagSet("alfheim-setup update", flag.ContinueOnError)
	fs.SetOutput(stderr)
	fs.Usage = func() { fmt.Fprint(stderr, updateUsage) }

	fs.StringVar(&opts.Version, "version", "", "release to update to")
	fs.StringVar(&opts.InstallDir, "install-dir", "", "installation root")
	fs.StringVar(&opts.Repo, "repo", "", "release repository")
	fs.BoolVar(&opts.Yes, "yes", false, "skip the confirmation prompt")

	if err := fs.Parse(args); err != nil {
		return nil, fmt.Errorf("alfheim-setup update: %w", err)
	}
	if fs.NArg() > 0 {
		fmt.Fprint(stderr, updateUsage)
		return nil, fmt.Errorf("alfheim-setup update: unexpected argument %q", fs.Arg(0))
	}

	if opts.Version == "" {
		opts.Version = strings.TrimSpace(os.Getenv("ALFHEIM_VERSION"))
	}
	if opts.InstallDir == "" {
		opts.InstallDir = strings.TrimSpace(os.Getenv("ALFHEIM_INSTALL_DIR"))
	}
	if opts.Repo == "" {
		opts.Repo = strings.TrimSpace(os.Getenv("ALFHEIM_REPO"))
	}
	if opts.Repo == "" {
		opts.Repo = defaultUpdateRepo
	}
	if opts.InstallDir == "" {
		cwd, err := os.Getwd()
		if err != nil {
			return nil, fmt.Errorf("alfheim-setup update: resolve working directory: %w", err)
		}
		opts.InstallDir = cwd
	}
	return opts, nil
}
