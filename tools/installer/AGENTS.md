# AGENTS.md — tools/installer (`alfheim-setup`)

Go CLI that installs, updates, backs up and restores an Alfheim stack. Adds to the
[root rules](../../AGENTS.md). Conventions: [Go](../../docs/en/reference/conventions/go.md).
Command reference: [Installer CLI](../../docs/en/reference/installer-cli.md).

## Commands

```bash
cd tools/installer && go test -race -cover ./...
gofmt -l .                  # must print nothing
./scripts/verify.sh --go    # full gate from the repo root, must exit 0
```

## Specific to this tool

- Coverage must stay at or above 80 %.
- Layout is `cmd/alfheim-setup` (entry point) and `internal/{app,features,shared}`; features own their logic and tests.
- The installer generates secrets and writes `.env` files. Never log secret values and never commit generated env files.
- Backup and restore must be safe to re-run; fail with a clear error instead of overwriting data silently.
- A change to the CLI surface (flags, subcommands, output) updates `docs/en/reference/installer-cli.md` in the docs commit.
